/**
 * 识图客户端：把「学生答题截图」交给 OpenAI 兼容的视觉模型，转写成纯文字。
 *
 * 只做一件事：截图 → 文字。文字填进「学生作答」后再交给 Jev 判分，
 * 这样判分链路的输入仍然是可编辑、可审计的文本，也避免把图片塞进 Jev 的 state。
 *
 * 兼容性说明：
 * - Base URL 允许填 https://api.openai.com、https://api.openai.com/v1 或完整 .../chat/completions；
 * - 请求体只用最通用的字段（model / messages / image_url），不发送 temperature、max_tokens，
 *   避免各家网关与 o 系列模型对参数的额外限制导致 400；
 * - 浏览器直连第三方网关常被 CORS 拦，dev / preview 内置了一个把目标地址放在请求头的动态代理
 *   `/api/vision-proxy`（见 vite.config.ts），前端默认「先代理、后直连」。
 */

import { isCrossOriginFailure } from './jev'
import type { ExamQuestion, SubjectProfile } from '../types/exam'
import type {
  ScreenshotTranscript,
  VisionCallResult,
  VisionImage,
  VisionSettings,
  VisionUsage,
} from '../types/vision'

export const VISION_DEFAULTS: VisionSettings = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: '',
  autoGrade: true,
}

/** 一次最多几张截图（多张会作为同一条 user 消息里的多个 image_url）。 */
export const VISION_MAX_IMAGES = 4
/** 长边超过该像素就先等比缩小，避免 data URL 过大拖慢请求。 */
export const VISION_MAX_EDGE = 1600
export const VISION_MAX_FILE_MB = 12

export const VISION_CORS_HINT =
  'npm run dev / preview 已内置 /api/vision-proxy 动态代理（目标地址放在 x-vision-target 请求头里）；' +
  'Vercel 部署已内置同名 Serverless Function（默认放行任意公网 http / https 网关，可用环境变量 VISION_ALLOWED_HOSTS 收紧为白名单），' +
  '其他环境可以用 Nginx 把 /api/vision-proxy 反向代理到你的模型网关。'

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529])
/** 识图比纯文本判分慢得多（大模型看图 + 长转写），默认给足 2 分钟。 */
export const VISION_TIMEOUT_MS = 120_000
const DEFAULT_MAX_RETRIES = 1

export class VisionError extends Error {
  readonly status?: number
  readonly retryable: boolean

  constructor(message: string, options: { status?: number; retryable?: boolean } = {}) {
    super(message)
    this.name = 'VisionError'
    this.status = options.status
    this.retryable = options.retryable ?? false
  }
}

/* ------------------------------------------------------------------ */
/* URL 归一化与端点选择                                                */
/* ------------------------------------------------------------------ */

/** 允许填 https://host、https://host/v1 或完整 .../chat/completions。 */
export function normalizeVisionEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/\/chat\/completions(\?.*)?$/i.test(trimmed)) return trimmed
  if (/\/v\d+$/i.test(trimmed)) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
}

/** 拆成「网关根地址 + 路径」，方便走内置代理时把根地址放进请求头。 */
export function splitChatCompletionsUrl(endpoint: string): { target: string; path: string } | null {
  const index = endpoint.search(/\/chat\/completions(\?|$)/i)
  if (index <= 0) return null
  return { target: endpoint.slice(0, index), path: endpoint.slice(index) }
}

export interface VisionEndpoint {
  /** 前端实际 fetch 的地址。 */
  url: string
  /** 走内置代理时，上游网关根地址（放进 x-vision-target）。 */
  target?: string
  label: '内置代理' | '直连' | '同源'
}

/**
 * 返回可尝试的端点顺序：
 * - 相对路径（自建反代）→ 只有一个同源端点；
 * - 绝对地址 → 开发环境先试内置代理再直连，生产环境相反。
 */
export function resolveVisionEndpoints(
  baseUrl: string,
  preferProxy: boolean = import.meta.env.DEV,
): VisionEndpoint[] {
  const endpoint = normalizeVisionEndpoint(baseUrl)
  if (!endpoint) return []
  if (!/^https?:\/\//i.test(endpoint)) return [{ url: endpoint, label: '同源' }]

  const split = splitChatCompletionsUrl(endpoint)
  if (!split) return [{ url: endpoint, label: '直连' }]

  const proxy: VisionEndpoint = { url: `/api/vision-proxy${split.path}`, target: split.target, label: '内置代理' }
  const direct: VisionEndpoint = { url: endpoint, label: '直连' }
  return preferProxy ? [proxy, direct] : [direct, proxy]
}

export function isVisionConfigured(settings: VisionSettings): boolean {
  return Boolean(settings.apiKey.trim() && normalizeVisionEndpoint(settings.baseUrl))
}

/* ------------------------------------------------------------------ */
/* 提示词                                                              */
/* ------------------------------------------------------------------ */

export const VISION_SYSTEM_PROMPT = [
  '你是一个严谨的试卷作答识别助手，只负责把图片里的学生作答转写成文字。',
  '规则：',
  '1. 只转写图片中学生实际写下的内容，不解答题目、不补全、不修改、不评价、不批改。',
  '2. 保持原有顺序与分点；数学公式用 LaTeX（行内 $...$，独立公式 $$...$$）；化学方程式按原样转写；单位与符号不要漏。',
  '3. 表格转成 Markdown 表格；作图的文字标注按位置顺序列出。',
  '4. 看不清的字用 [?] 标注；整段无法辨认时写 [无法辨认]。',
  '5. 图片里没有学生作答内容时，只输出 NO_ANSWER。',
  '6. 直接输出转写结果，不要前言、解释、总结，也不要用代码块包裹。',
].join('\n')

/** 给模型一点题目上下文，但绝不提供标准答案，避免它「顺手改对」学生答案。 */
export function buildVisionPrompt(question: ExamQuestion, subject?: SubjectProfile): string {
  const lines = [
    subject ? `这是「${subject.label}」试卷的第 ${question.no} 题（${question.kindLabel}）。` : `这是第 ${question.no} 题（${question.kindLabel}）。`,
    `题目：${question.stem}`,
    '请只转写学生在图上写下的作答，不要依据题目补全或修正。',
  ]
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* 请求                                                                */
/* ------------------------------------------------------------------ */

export function buildVisionRequestBody(settings: VisionSettings, images: VisionImage[], prompt: string) {
  return {
    model: settings.model.trim() || VISION_DEFAULTS.model,
    messages: [
      { role: 'system', content: VISION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map((image) => ({ type: 'image_url', image_url: { url: image.dataUrl } })),
        ],
      },
    ],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function pickUsage(payload: unknown): VisionUsage | undefined {
  if (!isRecord(payload) || !isRecord(payload.usage)) return undefined
  const usage = payload.usage
  const input = asNumber(usage.prompt_tokens) ?? asNumber(usage.input_tokens)
  const output = asNumber(usage.completion_tokens) ?? asNumber(usage.output_tokens)
  if (input === null && output === null) return undefined
  return {
    ...(input !== null ? { input_tokens: input } : {}),
    ...(output !== null ? { output_tokens: output } : {}),
  }
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (isRecord(part) && typeof part.text === 'string') return part.text
      return ''
    })
    .join('')
}

/** 从 Chat Completions 响应里取出文字，并清掉模型偶尔加上的代码块与抬头。 */
export function extractVisionText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    throw new VisionError('识图模型响应缺少 choices')
  }
  const first = payload.choices[0]
  const message = isRecord(first) && isRecord(first.message) ? first.message : undefined
  let text = contentToText(message?.content).trim()

  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```$/, '').trim()
  }
  text = text.replace(/^(识别结果|转写结果|学生作答|作答内容)[:：]\s*/, '')
  if (/^no[_\-\s]?answer$/i.test(text)) return ''
  return text
}

interface ChatCallOptions {
  signal?: AbortSignal
  timeoutMs?: number
  maxRetries?: number
  preferProxy?: boolean
  fetchImpl?: typeof fetch
}

export interface ChatCallResult {
  payload: unknown
  model?: string
  usage?: VisionUsage
  elapsedMs: number
  url: string
  requestBody: unknown
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

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  if (!text) return ''
  try {
    const parsed: unknown = JSON.parse(text)
    if (isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === 'string') {
      return parsed.error.message
    }
  } catch {
    /* 不是 JSON，按纯文本截断 */
  }
  return text.slice(0, 300)
}

async function callEndpoint(
  endpoint: VisionEndpoint,
  settings: VisionSettings,
  requestBody: unknown,
  options: ChatCallOptions,
): Promise<ChatCallResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? VISION_TIMEOUT_MS
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const startedAt = performance.now()
  let lastError: unknown = null

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      }
      if (endpoint.target) headers['x-vision-target'] = endpoint.target

      const response = await fetchImpl(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        const detail = await readErrorBody(response)
        const retryable = RETRYABLE_STATUS.has(response.status)
        if (retryable && attempt < maxRetries) {
          await delay(300 * 2 ** attempt, options.signal)
          continue
        }
        throw new VisionError(
          `识图模型返回 HTTP ${response.status}${detail ? `：${detail}` : ''}`,
          { status: response.status, retryable },
        )
      }

      const payload: unknown = await response.json()
      return {
        payload,
        model: isRecord(payload) && typeof payload.model === 'string' ? payload.model : undefined,
        usage: pickUsage(payload),
        elapsedMs: Math.round(performance.now() - startedAt),
        url: endpoint.url,
        requestBody,
      }
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const normalized =
        error instanceof DOMException && error.name === 'TimeoutError'
          ? new VisionError(`识图请求超时（${Math.round(timeoutMs / 1000)} s），可换更快的模型或压缩图片`, {
              retryable: true,
            })
          : error
      // 网络层失败（多为 CORS / 代理不可用）：交给上层切换另一种端点，重试没有意义。
      if (isCrossOriginFailure(normalized)) throw normalized
      lastError = normalized
      if (normalized instanceof VisionError && !normalized.retryable) throw normalized
      if (attempt < maxRetries) {
        await delay(300 * 2 ** attempt, options.signal)
        continue
      }
    }
  }

  throw lastError instanceof Error ? lastError : new VisionError(String(lastError))
}

/** 按候选端点依次尝试，全部失败时给出可操作的提示。 */
export async function callChatCompletions(
  settings: VisionSettings,
  requestBody: unknown,
  options: ChatCallOptions = {},
): Promise<ChatCallResult> {
  if (!settings.apiKey.trim()) throw new VisionError('请先填写识图模型的 API Key')
  const endpoints = resolveVisionEndpoints(settings.baseUrl, options.preferProxy)
  if (endpoints.length === 0) throw new VisionError('请先填写识图模型 Base URL')

  let lastError: unknown = null
  for (const endpoint of endpoints) {
    try {
      return await callEndpoint(endpoint, settings, requestBody, options)
    } catch (error) {
      lastError = error
      // 只有网络层失败（CORS、代理没装）才换端点；HTTP 错误直接抛给用户。
      if (!isCrossOriginFailure(error)) throw error
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError)
  throw new VisionError(`请求识图模型失败（${reason}）。${VISION_CORS_HINT}`, { retryable: false })
}

/* ------------------------------------------------------------------ */
/* 对外 API                                                            */
/* ------------------------------------------------------------------ */

export interface TranscribeInput {
  settings: VisionSettings
  images: VisionImage[]
  question: ExamQuestion
  subject?: SubjectProfile
  signal?: AbortSignal
  timeoutMs?: number
  maxRetries?: number
  preferProxy?: boolean
  fetchImpl?: typeof fetch
}

export async function transcribeAnswerImages(input: TranscribeInput): Promise<VisionCallResult> {
  const { settings, images } = input
  if (images.length === 0) throw new VisionError('请先上传答题截图')
  if (images.length > VISION_MAX_IMAGES) {
    throw new VisionError(`一次最多上传 ${VISION_MAX_IMAGES} 张截图，当前 ${images.length} 张`)
  }

  const requestBody = buildVisionRequestBody(settings, images, buildVisionPrompt(input.question, input.subject))
  const call = await callChatCompletions(settings, requestBody, input)
  return {
    text: extractVisionText(call.payload),
    model: call.model,
    usage: call.usage,
    elapsedMs: call.elapsedMs,
    url: call.url,
    requestBody,
    responseBody: call.payload,
  }
}

export interface VisionPingResult {
  reply: string
  model?: string
  elapsedMs: number
  url: string
}

/** 用一条极短的文本消息验证 base_url / api_key / model 是否可用（不消耗图片 token）。 */
export async function pingVision(
  settings: VisionSettings,
  options: ChatCallOptions = {},
): Promise<VisionPingResult> {
  const requestBody = {
    model: settings.model.trim() || VISION_DEFAULTS.model,
    messages: [{ role: 'user', content: '这是一次连接测试，请只回复两个字：可用' }],
  }
  const call = await callChatCompletions(settings, requestBody, { maxRetries: 0, ...options })
  return {
    reply: extractVisionText(call.payload) || '（空响应）',
    model: call.model,
    elapsedMs: call.elapsedMs,
    url: call.url,
  }
}

/* ------------------------------------------------------------------ */
/* 图片预处理（只在浏览器里用）                                        */
/* ------------------------------------------------------------------ */

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new VisionError(`读取「${file.name || '图片'}」失败`))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new VisionError('图片解码失败，请换一张 PNG / JPG / WebP 截图'))
    image.src = src
  })
}

/** 等比缩小到长边 maxEdge，并转成 JPEG（白底），减小 data URL 体积。 */
async function downscaleImage(file: File, maxEdge: number): Promise<string> {
  const raw = await readAsDataUrl(file)
  if (typeof document === 'undefined') return raw
  try {
    const image = await loadImage(raw)
    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    if (!sourceWidth || !sourceHeight) return raw
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight))
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return raw
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch {
    return raw
  }
}

export async function prepareImageFiles(
  files: File[],
  maxEdge: number = VISION_MAX_EDGE,
): Promise<VisionImage[]> {
  const selected = files.filter((file) => file.size > 0)
  if (selected.length === 0) throw new VisionError('没有读取到图片文件')
  if (selected.length > VISION_MAX_IMAGES) {
    throw new VisionError(`一次最多上传 ${VISION_MAX_IMAGES} 张截图，当前 ${selected.length} 张`)
  }

  const images: VisionImage[] = []
  for (const file of selected) {
    if (!/^image\//i.test(file.type)) {
      throw new VisionError(`「${file.name || '未命名文件'}」不是图片，请上传 PNG / JPG / WebP 截图`)
    }
    if (file.size > VISION_MAX_FILE_MB * 1024 * 1024) {
      throw new VisionError(`「${file.name}」超过 ${VISION_MAX_FILE_MB} MB，请先压缩再上传`)
    }
    images.push({ name: file.name, dataUrl: await downscaleImage(file, maxEdge) })
  }
  return images
}

export function describeVisionError(error: unknown): string {
  if (error instanceof VisionError) return error.message
  if (error instanceof DOMException && error.name === 'AbortError') return '已取消'
  return error instanceof Error ? error.message : String(error)
}

/** 便捷工厂：识别成功后要留存的元信息。 */
export function buildTranscript(
  questionId: string,
  result: VisionCallResult,
  images: VisionImage[],
): ScreenshotTranscript {
  return {
    id: `${questionId}-${Date.now()}`,
    questionId,
    text: result.text,
    model: result.model ?? '',
    fileNames: images.map((image) => image.name ?? '截图'),
    elapsedMs: result.elapsedMs,
    at: new Date().toISOString(),
    usage: result.usage,
    endpoint: result.url,
  }
}