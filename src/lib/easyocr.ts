/**
 * EasyOCR 在线 OCR 客户端：答题截图 → 文字。
 *
 * 官方文档：https://easyocr.org/zh/quick-start
 *
 * - 接口：POST https://console.easyocr.org/api/ocr，multipart/form-data（file + X-Access-Key）；
 * - 一次请求只识别一张图（最大 3 MB），多张截图会按顺序逐张识别，文字用换行拼接；
 * - 返回的 words[] 是带坐标的文字块，按 y 聚类成行、行内按 x 排序后拼成文本；
 * - 官方接口支持 CORS，浏览器可直连；`vite dev / preview` 与 Vercel 仍内置
 *   `/api/easyocr-proxy` 同源代理作为回退（见 vite.config.ts / api/easyocr-proxy.ts）。
 */

import { isCrossOriginFailure } from './jev'
import type { VisionCallResult, VisionSettings, VisionUsage } from '../types/vision'

export const EASYOCR_DEFAULT_ENDPOINT = 'https://console.easyocr.org/api/ocr'
/** 官方说明：单张图最大 3 MB，一次只收一张。 */
export const EASYOCR_MAX_FILE_MB = 3
/** 与识图模型保持一致：一次最多 4 张截图（多张时逐张请求）。 */
export const EASYOCR_MAX_IMAGES = 4
/** 长边超过该像素先等比缩小，既省流量也压低计费档位。 */
export const EASYOCR_MAX_EDGE = 1600
export const EASYOCR_TIMEOUT_MS = 60_000

export const EASYOCR_CORS_HINT =
  'npm run dev / preview 已内置 /api/easyocr-proxy 同源代理；' +
  'Vercel 部署已内置同名 Serverless Function；其他环境可以用 Nginx 把 /api/easyocr-proxy 反向代理到 https://console.easyocr.org/api/ocr。'

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
/** 官方建议 5xx / 503 退避重试（预扣点数会自动退还），默认最多重试 2 次。 */
const DEFAULT_MAX_RETRIES = 2

export class EasyOcrError extends Error {
  readonly status?: number
  readonly retryable: boolean

  constructor(message: string, options: { status?: number; retryable?: boolean } = {}) {
    super(message)
    this.name = 'EasyOcrError'
    this.status = options.status
    this.retryable = options.retryable ?? false
  }
}

/* ------------------------------------------------------------------ */
/* 端点归一化与选择                                                    */
/* ------------------------------------------------------------------ */

export function normalizeEasyOcrEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '')
  return trimmed || EASYOCR_DEFAULT_ENDPOINT
}

function isOfficialEndpoint(endpoint: string): boolean {
  try {
    return new URL(endpoint).hostname.toLowerCase() === 'console.easyocr.org'
  } catch {
    return false
  }
}

export function isEasyOcrConfigured(settings: VisionSettings): boolean {
  return Boolean(settings.easyocrAccessKey.trim())
}

export interface EasyOcrEndpoint {
  /** 前端实际 fetch 的地址。 */
  url: string
  label: '内置代理' | '直连' | '同源'
}

/**
 * 返回可尝试的端点顺序：
 * - 相对路径（自建反代）→ 只有一个同源端点；
 * - 官方地址 → 开发环境先试内置代理再直连，生产环境相反；
 * - 自定义地址（开了 CORS 的镜像 / 反代）→ 只能直连。
 */
export function resolveEasyOcrEndpoints(
  endpoint: string,
  preferProxy: boolean = import.meta.env.DEV,
): EasyOcrEndpoint[] {
  const normalized = normalizeEasyOcrEndpoint(endpoint)
  if (!/^https?:\/\//i.test(normalized)) return [{ url: normalized, label: '同源' }]
  if (!isOfficialEndpoint(normalized)) return [{ url: normalized, label: '直连' }]

  const proxy: EasyOcrEndpoint = { url: '/api/easyocr-proxy', label: '内置代理' }
  const direct: EasyOcrEndpoint = { url: normalized, label: '直连' }
  return preferProxy ? [proxy, direct] : [direct, proxy]
}

/* ------------------------------------------------------------------ */
/* words[] → 文字                                                      */
/* ------------------------------------------------------------------ */

export interface EasyOcrWord {
  text: string
  rate?: number
  left?: number
  top?: number
  right?: number
  bottom?: number
}

interface PositionedWord {
  text: string
  left: number
  top: number
  right: number
  bottom: number
}

const CJK_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function normalizeEasyOcrWords(input: unknown): EasyOcrWord[] {
  if (!Array.isArray(input)) return []
  const words: EasyOcrWord[] = []
  for (const item of input) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    if (typeof record.text !== 'string' || !record.text.trim()) continue
    words.push({
      text: record.text,
      rate: toNumber(record.rate),
      left: toNumber(record.left),
      top: toNumber(record.top),
      right: toNumber(record.right),
      bottom: toNumber(record.bottom),
    })
  }
  return words
}

/** 中英混排：两侧都是字母数字、或一侧是 CJK 另一侧是字母数字时补一个空格。 */
function needsSpace(previous: string, next: string): boolean {
  const left = previous.slice(-1)
  const right = next.slice(0, 1)
  const leftAlnum = /[A-Za-z0-9]/.test(left)
  const rightAlnum = /[A-Za-z0-9]/.test(right)
  if (leftAlnum && rightAlnum) return true
  if (leftAlnum !== rightAlnum) return CJK_PATTERN.test(leftAlnum ? right : left)
  return false
}

/**
 * 把带坐标的文字块整理成可读文本：先按 top 排序，把垂直方向重叠的块聚成同一行，
 * 行内按 left 排序，再按中英混排规则拼接。
 */
export function wordsToText(words: EasyOcrWord[]): string {
  const items: PositionedWord[] = words
    .filter((word) => typeof word.text === 'string' && word.text.trim().length > 0)
    .map((word) => ({
      text: word.text.trim(),
      left: toNumber(word.left),
      top: toNumber(word.top),
      right: toNumber(word.right),
      bottom: toNumber(word.bottom),
    }))
  if (items.length === 0) return ''

  items.sort((a, b) => a.top - b.top || a.left - b.left)

  const lines: Array<{ center: number; height: number; words: PositionedWord[] }> = []
  for (const word of items) {
    const center = (word.top + word.bottom) / 2
    const height = Math.max(1, word.bottom - word.top)
    const line = lines[lines.length - 1]
    const tolerance = line ? Math.max(8, 0.6 * Math.max(height, line.height)) : 0
    if (line && Math.abs(center - line.center) <= tolerance) {
      line.center = (line.center * line.words.length + center) / (line.words.length + 1)
      line.height = Math.max(line.height, height)
      line.words.push(word)
    } else {
      lines.push({ center, height, words: [word] })
    }
  }

  return lines
    .map((line) =>
      [...line.words]
        .sort((a, b) => a.left - b.left)
        .reduce((text, word, index, all) => (index === 0 ? word.text : text + (needsSpace(all[index - 1].text, word.text) ? ' ' : '') + word.text), ''),
    )
    .filter(Boolean)
    .join('\n')
}

/* ------------------------------------------------------------------ */
/* 请求                                                                */
/* ------------------------------------------------------------------ */

export interface EasyOcrImage {
  name: string
  blob: Blob
}

interface EasyOcrCallOptions {
  signal?: AbortSignal
  timeoutMs?: number
  maxRetries?: number
  preferProxy?: boolean
  fetchImpl?: typeof fetch
}

interface EasyOcrCallResult {
  text: string
  wordCount: number
  payload: unknown
  requestId?: string
  cost?: number
  remainingQuota?: number
  elapsedMs: number
  url: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

interface EasyOcrFailure {
  code: string
  message: string
  needed?: number
  balance?: number
  requestId?: string
}

/** 机器可读的错误标识（如 invalid_access_key），用来判断是否要在提示里重复展示。 */
function isMachineCode(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/i.test(value)
}

async function readFailure(response: Response): Promise<EasyOcrFailure> {
  const text = await response.text().catch(() => '')
  if (!text) return { code: '', message: '' }
  try {
    const parsed: unknown = JSON.parse(text)
    if (isRecord(parsed)) {
      const code = typeof parsed.error === 'string' ? parsed.error : ''
      const explicitMessage = typeof parsed.message === 'string' ? parsed.message : ''
      // 500 / 503 的 error 字段是服务端返回的具体原因（例如「OCR 服务返回错误：… 错误码: -1」），
      // 这种不是机器码，要原样带进提示；invalid_access_key 之类的标识则不用重复。
      const message = explicitMessage || (isMachineCode(code) ? '' : code)
      return {
        code,
        message: message || text.slice(0, 300),
        needed:
          asNumber(parsed.required_points) ?? asNumber(parsed.required) ?? asNumber(parsed.needed) ?? asNumber(parsed.cost),
        balance: asNumber(parsed.remaining_quota) ?? asNumber(parsed.balance) ?? asNumber(parsed.remaining),
        requestId: typeof parsed.request_id === 'string' ? parsed.request_id : undefined,
      }
    }
  } catch {
    /* 不是 JSON，按纯文本截断 */
  }
  return { code: '', message: text.slice(0, 300) }
}

/** 把 HTTP 状态码 + error 字段翻译成可操作的中文提示（导出便于单测）。 */
export function describeEasyOcrFailure(status: number, failure: EasyOcrFailure): string {
  const detail = failure.message ? `：${failure.message}` : ''
  const trace = failure.requestId ? `（request_id: ${failure.requestId}）` : ''
  if (failure.code === 'invalid_access_key' || status === 401) {
    return 'EasyOCR Access Key 无效（401）：请到 console.easyocr.org 创建或更换 Access Key'
  }
  if (failure.code === 'insufficient_credits' || status === 402) {
    const quota =
      failure.needed !== undefined || failure.balance !== undefined
        ? `（本次需要 ${failure.needed ?? '—'} 点，当前余额 ${failure.balance ?? '—'} 点）`
        : ''
    return `EasyOCR 点数不足（402）${quota}，请到 console.easyocr.org 充值`
  }
  if (failure.code === 'user_disabled' || status === 403) {
    return '当前 EasyOCR 账号已被停用（403），请联系 EasyOCR 管理员'
  }
  if (failure.code === 'quota_account_missing' || status === 404) {
    return 'EasyOCR 账户点数记录不存在（404），请联系 EasyOCR 管理员'
  }
  if (status === 400) return `EasyOCR 上传校验失败（400）${detail}`
  if (status === 500) {
    return `EasyOCR 服务内部错误（500）${detail}${trace}，预扣点数会自动退还，稍后重试即可`
  }
  if (status === 503) {
    return `EasyOCR 服务当前不可用（503）${detail}${trace}，预扣点数会自动退还，稍后重试即可`
  }
  return `EasyOCR 返回 HTTP ${status}${detail}${trace}`
}

async function callEndpoint(
  endpoint: EasyOcrEndpoint,
  accessKey: string,
  image: EasyOcrImage,
  options: EasyOcrCallOptions,
): Promise<EasyOcrCallResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? EASYOCR_TIMEOUT_MS
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const startedAt = performance.now()
  let lastError: unknown = null

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const form = new FormData()
      form.append('file', image.blob, image.name)
      // 官方推荐 X-Access-Key 请求头，同时带上兼容表单字段 access_key。
      form.append('access_key', accessKey)

      const response = await fetchImpl(endpoint.url, {
        method: 'POST',
        headers: { 'X-Access-Key': accessKey },
        body: form,
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        const failure = await readFailure(response)
        const retryable = RETRYABLE_STATUS.has(response.status)
        if (retryable && attempt < maxRetries) {
          await delay(300 * 2 ** attempt, options.signal)
          continue
        }
        throw new EasyOcrError(describeEasyOcrFailure(response.status, failure), {
          status: response.status,
          retryable,
        })
      }

      const payload: unknown = await response.json()
      const words = normalizeEasyOcrWords(isRecord(payload) ? payload.words : undefined)
      return {
        text: wordsToText(words),
        wordCount: words.length,
        payload,
        requestId: isRecord(payload) && typeof payload.request_id === 'string' ? payload.request_id : undefined,
        cost: isRecord(payload) ? asNumber(payload.cost) : undefined,
        remainingQuota: isRecord(payload) ? asNumber(payload.remaining_quota) : undefined,
        elapsedMs: Math.round(performance.now() - startedAt),
        url: endpoint.url,
      }
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const normalized =
        error instanceof DOMException && error.name === 'TimeoutError'
          ? new EasyOcrError(`EasyOCR 请求超时（${Math.round(timeoutMs / 1000)} s），请压缩图片或稍后重试`, {
              retryable: true,
            })
          : error
      // 网络层失败（多为 CORS / 代理不可用）：交给上层切换另一种端点，重试没有意义。
      if (isCrossOriginFailure(normalized)) throw normalized
      lastError = normalized
      if (normalized instanceof EasyOcrError && !normalized.retryable) throw normalized
      if (attempt < maxRetries) {
        await delay(300 * 2 ** attempt, options.signal)
        continue
      }
    }
  }

  throw lastError instanceof Error ? lastError : new EasyOcrError(String(lastError))
}

/* ------------------------------------------------------------------ */
/* 对外 API                                                            */
/* ------------------------------------------------------------------ */

export interface EasyOcrTranscribeInput {
  settings: VisionSettings
  images: EasyOcrImage[]
  signal?: AbortSignal
  timeoutMs?: number
  maxRetries?: number
  preferProxy?: boolean
  fetchImpl?: typeof fetch
}

/** 逐张识别（官方一次只收一张图），结果按上传顺序换行拼接。 */
export async function transcribeWithEasyOcr(input: EasyOcrTranscribeInput): Promise<VisionCallResult> {
  const accessKey = input.settings.easyocrAccessKey.trim()
  if (!accessKey) throw new EasyOcrError('请先填写 EasyOCR Access Key（到 console.easyocr.org 创建）')
  if (input.images.length === 0) throw new EasyOcrError('请先上传答题截图')
  if (input.images.length > EASYOCR_MAX_IMAGES) {
    throw new EasyOcrError(`一次最多上传 ${EASYOCR_MAX_IMAGES} 张截图，当前 ${input.images.length} 张`)
  }

  const endpoints = resolveEasyOcrEndpoints(input.settings.easyocrEndpoint, input.preferProxy)
  if (endpoints.length === 0) throw new EasyOcrError('请先填写 EasyOCR 接口地址')

  const startedAt = performance.now()
  const texts: string[] = []
  const payloads: unknown[] = []
  let cost = 0
  let remainingQuota: number | undefined
  let requestId: string | undefined
  let usedUrl = endpoints[0].url

  for (const image of input.images) {
    let call: EasyOcrCallResult | null = null
    let lastError: unknown = null
    for (const endpoint of endpoints) {
      try {
        call = await callEndpoint(endpoint, accessKey, image, input)
        break
      } catch (error) {
        lastError = error
        // 只有网络层失败（CORS、代理没装）才换端点；HTTP 错误直接抛给用户。
        if (!isCrossOriginFailure(error)) throw error
      }
    }
    if (!call) {
      const reason = lastError instanceof Error ? lastError.message : String(lastError)
      throw new EasyOcrError(`请求 EasyOCR 失败（${reason}）。${EASYOCR_CORS_HINT}`, { retryable: false })
    }
    if (call.text) texts.push(call.text)
    payloads.push(call.payload)
    cost += call.cost ?? 0
    remainingQuota = call.remainingQuota ?? remainingQuota
    requestId ??= call.requestId
    usedUrl = call.url
  }

  const usage: VisionUsage = {}
  if (cost > 0) usage.cost = cost
  if (remainingQuota !== undefined) usage.remaining_quota = remainingQuota

  return {
    text: texts.join('\n'),
    engine: 'easyocr',
    model: 'easyocr',
    usage: Object.keys(usage).length > 0 ? usage : undefined,
    elapsedMs: Math.round(performance.now() - startedAt),
    url: usedUrl,
    requestBody: {
      endpoint: normalizeEasyOcrEndpoint(input.settings.easyocrEndpoint),
      file_names: input.images.map((image) => image.name),
      request_id: requestId,
    },
    responseBody: payloads,
  }
}

export interface EasyOcrPingResult {
  message: string
  wordCount: number
  remainingQuota?: number
  cost?: number
  elapsedMs: number
  url: string
}

/** 1×1 白色 PNG：非浏览器环境（单测 / SSR）没有 canvas 时的兜底，消耗 1 点。 */
const PING_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type })
}

/**
 * 测试用图：浏览器里用 canvas 画一张 200×60、带「OCR 测试」文字的小图（消耗 2 点）。
 * 1×1 纯白图容易让服务端 OCR 引擎报「错误码 -1」，所以只作为无 canvas 时的兜底。
 */
function pingImage(): EasyOcrImage {
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 60
      const context = canvas.getContext('2d')
      if (context) {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#111111'
        context.font = '28px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
        context.textBaseline = 'middle'
        context.fillText('OCR 测试', 16, 31)
        const dataUrl = canvas.toDataURL('image/png')
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
        if (base64) return { name: 'easyocr-ping.png', blob: base64ToBlob(base64, 'image/png') }
      }
    } catch {
      /* 无 canvas（单测 / SSR）时走 1×1 兜底 */
    }
  }
  return { name: 'easyocr-ping.png', blob: base64ToBlob(PING_IMAGE_BASE64, 'image/png') }
}

/** 用一张带文字的小图验证 Access Key / 余额：成功识别即连接可用（消耗 1~2 点）。 */
export async function pingEasyOcr(
  settings: VisionSettings,
  options: EasyOcrCallOptions = {},
): Promise<EasyOcrPingResult> {
  const accessKey = settings.easyocrAccessKey.trim()
  if (!accessKey) throw new EasyOcrError('请先填写 EasyOCR Access Key')

  const endpoints = resolveEasyOcrEndpoints(settings.easyocrEndpoint, options.preferProxy)
  let lastError: unknown = null
  for (const endpoint of endpoints) {
    try {
      const call = await callEndpoint(endpoint, accessKey, pingImage(), { maxRetries: 1, ...options })
      const summary = isRecord(call.payload) && typeof call.payload.message === 'string' ? call.payload.message : ''
      return {
        message: summary || (call.wordCount > 0 ? `识别到 ${call.wordCount} 个文字块` : '连接可用'),
        wordCount: call.wordCount,
        remainingQuota: call.remainingQuota,
        cost: call.cost,
        elapsedMs: call.elapsedMs,
        url: call.url,
      }
    } catch (error) {
      lastError = error
      if (!isCrossOriginFailure(error)) throw error
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError)
  throw new EasyOcrError(`请求 EasyOCR 失败（${reason}）。${EASYOCR_CORS_HINT}`, { retryable: false })
}

export function describeEasyOcrError(error: unknown): string {
  if (error instanceof EasyOcrError) return error.message
  if (error instanceof DOMException && error.name === 'AbortError') return '已取消'
  return error instanceof Error ? error.message : String(error)
}

/* ------------------------------------------------------------------ */
/* 图片预处理（只在浏览器里用）                                        */
/* ------------------------------------------------------------------ */

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new EasyOcrError(`读取「${file.name || '图片'}」失败`))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new EasyOcrError('图片解码失败，请换一张 PNG / JPG / WebP 截图'))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality))
}

/** 等比缩小并转 JPEG，保证结果不超过 3 MB；浏览器不可用时原样返回（交给上游校验）。 */
async function compressToLimit(file: File, maxEdge: number): Promise<Blob> {
  if (typeof document === 'undefined') return file
  try {
    const raw = await readAsDataUrl(file)
    const image = await loadImage(raw)
    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    if (!sourceWidth || !sourceHeight) return file

    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sourceWidth * scale))
    canvas.height = Math.max(1, Math.round(sourceHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const limit = EASYOCR_MAX_FILE_MB * 1024 * 1024
    let blob: Blob | null = null
    for (let quality = 0.9; quality >= 0.5; quality -= 0.15) {
      blob = await canvasToBlob(canvas, quality)
      if (blob && blob.size > 0 && blob.size <= limit) return blob
    }
    if (blob && blob.size > limit) {
      // 最后一档质量仍然超限：再缩小 30% 重新编码一次。
      const shrink = document.createElement('canvas')
      shrink.width = Math.max(1, Math.round(canvas.width * 0.7))
      shrink.height = Math.max(1, Math.round(canvas.height * 0.7))
      const shrinkContext = shrink.getContext('2d')
      if (shrinkContext) {
        shrinkContext.fillStyle = '#ffffff'
        shrinkContext.fillRect(0, 0, shrink.width, shrink.height)
        shrinkContext.drawImage(canvas, 0, 0, shrink.width, shrink.height)
        const smaller = await canvasToBlob(shrink, 0.7)
        if (smaller && smaller.size > 0) return smaller
      }
    }
    return blob && blob.size > 0 ? blob : file
  } catch {
    return file
  }
}

export async function prepareEasyOcrImages(
  files: File[],
  maxEdge: number = EASYOCR_MAX_EDGE,
): Promise<EasyOcrImage[]> {
  const selected = files.filter((file) => file.size > 0)
  if (selected.length === 0) throw new EasyOcrError('没有读取到图片文件')
  if (selected.length > EASYOCR_MAX_IMAGES) {
    throw new EasyOcrError(`一次最多上传 ${EASYOCR_MAX_IMAGES} 张截图，当前 ${selected.length} 张`)
  }

  const images: EasyOcrImage[] = []
  for (const file of selected) {
    if (!/^image\//i.test(file.type)) {
      throw new EasyOcrError(`「${file.name || '未命名文件'}」不是图片，请上传 PNG / JPG / WebP 截图`)
    }
    const name = file.name || '答题截图.jpg'
    const blob = await compressToLimit(file, maxEdge)
    if (blob.size > EASYOCR_MAX_FILE_MB * 1024 * 1024) {
      throw new EasyOcrError(`「${name}」压缩后仍超过 ${EASYOCR_MAX_FILE_MB} MB，请先裁剪或压缩再上传`)
    }
    images.push({ name, blob })
  }
  return images
}