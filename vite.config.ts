import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 浏览器直连 https://api.typesafe.ai 会被 CORS 拦截（TypeError: Failed to fetch），
 * 所以 dev / preview 都内置一个同源代理：/api/typesafe/** → https://api.typesafe.ai/**。
 * 前端默认 Base URL 用相对路径 /api/typesafe，请求就是同源的，不触发 CORS。
 * 部署到自己的域名时，用 Nginx 等把同样的路径反代到 api.typesafe.ai 即可。
 */
const TYPESAFE_TARGET = process.env.TYPESAFE_TARGET ?? 'https://api.typesafe.ai'

const proxy = {
  '/api/typesafe': {
    target: TYPESAFE_TARGET,
    changeOrigin: true,
    secure: true,
    // 把 /api/typesafe/v1/systemone 还原成 /v1/systemone 再发给上游
    rewrite: (path: string) => path.replace(/^\/api\/typesafe/, ''),
  },
}

/**
 * 识图模型（OpenAI 兼容）的地址由使用者在前端填写，没法写死在 vite 配置里，
 * 所以这里做一个「目标地址放在请求头」的动态代理：
 *
 *   POST /api/vision-proxy/chat/completions
 *   x-vision-target: https://api.openai.com/v1
 *
 * 上游就是 `${x-vision-target}/chat/completions`，Authorization 原样透传。
 * 前端默认先走它、失败再直连；生产部署时可用 Nginx 提供同样的路径。
 */
function visionProxyPlugin(): Plugin {
  const attach = (middlewares: Connect.Server) => {
    middlewares.use('/api/vision-proxy', async (req, res) => {
      const target = String(req.headers['x-vision-target'] ?? '').trim().replace(/\/+$/, '')
      if (!/^https?:\/\//i.test(target)) {
        res.statusCode = 400
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: { message: '缺少合法的 x-vision-target 请求头' } }))
        return
      }

      try {
        const chunks: Buffer[] = []
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          for await (const chunk of req) chunks.push(chunk as Buffer)
        }
        const upstream = await fetch(`${target}${req.url ?? ''}`, {
          method: req.method,
          headers: {
            'content-type': String(req.headers['content-type'] ?? 'application/json'),
            ...(req.headers.authorization ? { authorization: String(req.headers.authorization) } : {}),
          },
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
        })
        const body = Buffer.from(await upstream.arrayBuffer())
        res.statusCode = upstream.status
        res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
        res.end(body)
      } catch (error) {
        res.statusCode = 502
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(
          JSON.stringify({
            error: { message: `识图代理请求失败：${error instanceof Error ? error.message : String(error)}` },
          }),
        )
      }
    })
  }

  return {
    name: 'vision-dev-proxy',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}

/**
 * EasyOCR 在线 OCR 的同源代理：官方接口支持 CORS，但代理可以让内网/受限环境也能用，
 * 生产环境用 api/easyocr-proxy.ts 提供同样语义的路径。
 *
 *   POST /api/easyocr-proxy  →  POST https://console.easyocr.org/api/ocr
 *
 * multipart 请求体与 X-Access-Key 请求头原样透传；换目标用 EASYOCR_TARGET 环境变量。
 */
const EASYOCR_TARGET = process.env.EASYOCR_TARGET ?? 'https://console.easyocr.org/api/ocr'

function easyOcrProxyPlugin(): Plugin {
  const attach = (middlewares: Connect.Server) => {
    middlewares.use('/api/easyocr-proxy', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'EasyOCR 代理只接受 POST' }))
        return
      }

      try {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const upstream = await fetch(EASYOCR_TARGET, {
          method: 'POST',
          headers: {
            // multipart 的 boundary 在 content-type 里，必须原样透传
            'content-type': String(req.headers['content-type'] ?? ''),
            ...(req.headers['x-access-key'] ? { 'X-Access-Key': String(req.headers['x-access-key']) } : {}),
          },
          body: Buffer.concat(chunks),
        })
        const body = Buffer.from(await upstream.arrayBuffer())
        res.statusCode = upstream.status
        res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
        res.end(body)
      } catch (error) {
        res.statusCode = 502
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(
          JSON.stringify({
            error: 'error',
            message: `EasyOCR 代理请求失败：${error instanceof Error ? error.message : String(error)}`,
          }),
        )
      }
    })
  }

  return {
    name: 'easyocr-dev-proxy',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}

export default defineConfig({
  plugins: [react(), visionProxyPlugin(), easyOcrProxyPlugin()],
  server: {
    port: 5199,
    proxy,
  },
  preview: {
    proxy,
  },
})