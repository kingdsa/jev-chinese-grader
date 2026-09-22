/**
 * 生产环境的识图代理（Vercel Serverless Function，Node runtime）。
 *
 * 文件名即路由：本项目只请求 /api/vision-proxy/chat/completions，
 * 所以用固定路径文件而不是 [...path]（非 Next 项目的 /api 不做动态段路由，会 404）。
 *
 * 默认开放：允许转发到任意公网 http / https 地址（多人各自网关不同时开箱即用），
 * 并拦截 localhost / 内网 / link-local / 云元数据等地址（DNS rebinding 无法完全防住）。
 * 要收紧就设 VISION_ALLOWED_HOSTS=域名列表（逗号分隔，支持 *.example.com），白名单只管域名、不管协议。
 * 注意 http 会把用户的 Key、图片与转写文字明文发到上游，建议只用于可信的自建网关。
 *
 *   POST /api/vision-proxy/chat/completions
 *   x-vision-target: https://api.openai.com/v1
 *   Authorization: Bearer <用户自己的识图 Key>
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export const config = { maxDuration: 60 }

const DEFAULT_ALLOWED_HOSTS = ['*']
const MAX_BODY_BYTES = 4 * 1024 * 1024
const MAX_BODY_MB = MAX_BODY_BYTES / 1024 / 1024
const CHAT_PATH = '/chat/completions'

/** VISION_ALLOWED_HOSTS 里显式声明的域名（没有则返回空数组）。 */
function explicitHosts(): string[] {
  return (process.env.VISION_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

function hostAllowed(hostname: string, patterns: string[]): boolean {
  const host = hostname.toLowerCase()
  return patterns.some((pattern) => {
    if (pattern === '*') return true
    return pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) : host === pattern
  })
}

/** 开放模式（VISION_ALLOWED_HOSTS=*）下禁止的目标：本机、内网、link-local、云元数据等。 */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host.endsWith('.internal') || host === 'metadata.google.internal') return true

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 198 && (b === 18 || b === 19)) return true
    return false
  }

  if (host.includes(':')) {
    if (host === '::' || host === '::1') return true
    if (host.startsWith('fe80') || host.startsWith('fc') || host.startsWith('fd')) return true
    const mapped = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mapped) return isBlockedHost(mapped[1])
  }

  return false
}

function sendJson(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: { message } }))
}

/** 只保留查询串（例如 Azure 风格的 ?api-version=...），路径固定为 /chat/completions。 */
function resolveUpstreamPath(url: string | undefined): string {
  const raw = url ?? ''
  const queryIndex = raw.indexOf('?')
  return queryIndex >= 0 ? `${CHAT_PATH}${raw.slice(queryIndex)}` : CHAT_PATH
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const target = String(req.headers['x-vision-target'] ?? '')
    .trim()
    .replace(/\/+$/, '')

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    sendJson(res, 400, '缺少合法的 x-vision-target 请求头（示例：https://api.openai.com/v1）')
    return
  }

  const declared = explicitHosts()
  const patterns = declared.length > 0 ? declared : DEFAULT_ALLOWED_HOSTS
  const openMode = patterns.some((host) => host === '*' || host === 'all')

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    sendJson(res, 400, `x-vision-target 只支持 http / https 地址，收到：${parsed.protocol}`)
    return
  }

  if (openMode) {
    if (isBlockedHost(parsed.hostname)) {
      sendJson(res, 403, `安全策略不允许代理到本机 / 内网地址：${parsed.hostname}`)
      return
    }
  } else if (!hostAllowed(parsed.hostname, patterns)) {
    sendJson(
      res,
      403,
      `目标网关 ${parsed.hostname} 不在 VISION_ALLOWED_HOSTS 白名单内。` +
        '设为 * 可放开任意公网 https 地址，或把该域名加进列表（逗号分隔，支持 *.example.com）',
    )
    return
  }

  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
    sendJson(res, 413, `请求体超过 ${MAX_BODY_MB} MB，请减少截图数量或降低分辨率`)
    return
  }

  let body: Buffer
  try {
    body = await readBody(req)
  } catch {
    sendJson(res, 413, `请求体超过 ${MAX_BODY_MB} MB，请减少截图数量或降低分辨率`)
    return
  }

  const basePath = parsed.pathname.replace(/\/+$/, '')
  const upstreamUrl = `${parsed.origin}${basePath}${resolveUpstreamPath(req.url)}`

  const headers: Record<string, string> = {
    'content-type': String(req.headers['content-type'] ?? 'application/json'),
  }
  if (req.headers.authorization) headers.authorization = String(req.headers.authorization)
  if (req.headers.accept) headers.accept = String(req.headers.accept)

  const method = req.method ?? 'POST'
  const requestBody = method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(body)

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body: requestBody,
      redirect: 'manual',
    })
    res.statusCode = upstream.status
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
    for (const name of ['location', 'retry-after'] as const) {
      const value = upstream.headers.get(name)
      if (value) res.setHeader(name, value)
    }
    res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    sendJson(res, 502, `识图代理请求失败：${error instanceof Error ? error.message : String(error)}`)
  }
}