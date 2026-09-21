import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5199,
    proxy,
  },
  preview: {
    proxy,
  },
})