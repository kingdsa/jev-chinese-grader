/**
 * 生产环境的 EasyOCR 代理（Vercel Serverless Function，Node runtime）。
 *
 * 文件名即路由：POST /api/easyocr-proxy → POST https://console.easyocr.org/api/ocr
 * multipart 请求体与 X-Access-Key 请求头原样透传，上游固定为官方接口
 * （可用环境变量 EASYOCR_TARGET 换成一个兼容镜像，避免变成公开转发服务）。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export const config = { maxDuration: 60 }

const EASYOCR_TARGET = process.env.EASYOCR_TARGET ?? 'https://console.easyocr.org/api/ocr'
const MAX_BODY_BYTES = 4 * 1024 * 1024
const MAX_BODY_MB = MAX_BODY_BYTES / 1024 / 1024

function sendJson(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: 'error', message }))
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, 'EasyOCR 代理只接受 POST')
    return
  }

  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
    sendJson(res, 413, `请求体超过 ${MAX_BODY_MB} MB，请压缩图片或减少上传数量`)
    return
  }

  const chunks: Buffer[] = []
  let total = 0
  try {
    for await (const chunk of req) {
      const buffer = chunk as Buffer
      total += buffer.length
      if (total > MAX_BODY_BYTES) {
        sendJson(res, 413, `请求体超过 ${MAX_BODY_MB} MB，请压缩图片或减少上传数量`)
        return
      }
      chunks.push(buffer)
    }
  } catch {
    sendJson(res, 413, `读取请求体失败或超过 ${MAX_BODY_MB} MB`)
    return
  }

  const headers: Record<string, string> = {
    // multipart 的 boundary 在 content-type 里，必须原样透传
    'content-type': String(req.headers['content-type'] ?? ''),
  }
  if (req.headers['x-access-key']) headers['X-Access-Key'] = String(req.headers['x-access-key'])

  try {
    const upstream = await fetch(EASYOCR_TARGET, {
      method: 'POST',
      headers,
      body: new Uint8Array(Buffer.concat(chunks)),
    })
    res.statusCode = upstream.status
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
    const retryAfter = upstream.headers.get('retry-after')
    if (retryAfter) res.setHeader('retry-after', retryAfter)
    res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    sendJson(res, 502, `EasyOCR 代理请求失败：${error instanceof Error ? error.message : String(error)}`)
  }
}