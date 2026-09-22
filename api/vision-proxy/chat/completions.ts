/**
 * 生产环境的识图代理（Vercel Serverless Function，Node runtime）。
 *
 * 文件名即路由：本项目只请求 /api/vision-proxy/chat/completions，
 * 所以用固定路径文件而不是 [...path]（非 Next 项目的 /api 不做动态段路由，会 404）。
 *
 * 与 dev / preview 里的通用转发不同，这里带白名单：只转发到 VISION_ALLOWED_HOSTS
 * 允许的网关（默认 api.openai.com），避免上线后变成公开的 SSRF 跳板。
 * 默认只接受 https；只支持 http 的网关必须显式写进 VISION_ALLOWED_HOSTS（会明文传输 Key 与图片）。
 *
 *   POST /api/vision-proxy/chat/completions
 *   x-vision-target: https://api.openai.com/v1
 *   Authorization: Bearer <用户自己的识图 Key>
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export const config = { maxDuration: 60 }

const DEFAULT_ALLOWED_HOSTS = ['api.openai.com']
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
  return patterns.some((pattern) =>
    pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) : host === pattern,
  )
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
  const isLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)
  // http 只在「显式声明」时放行：localhost 或写进 VISION_ALLOWED_HOSTS 的网关（此时会明文传输 Key 与图片）。
  const httpAllowed = isLocalhost || hostAllowed(parsed.hostname, declared)
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && httpAllowed)) {
    sendJson(
      res,
      400,
      'x-vision-target 必须是 https 地址；如果网关只支持 http，请把它的域名写进环境变量 VISION_ALLOWED_HOSTS 显式放行',
    )
    return
  }

  const patterns = declared.length > 0 ? declared : DEFAULT_ALLOWED_HOSTS
  if (!hostAllowed(parsed.hostname, patterns)) {
    sendJson(
      res,
      403,
      `目标网关 ${parsed.hostname} 不在白名单内。如确实需要，请在 Vercel 环境变量 VISION_ALLOWED_HOSTS 中追加（逗号分隔）`,
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