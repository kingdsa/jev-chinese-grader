/**
 * 「答题截图 → 文字」的类型定义。
 *
 * 识图用的是 OpenAI 兼容的 Chat Completions 接口（messages + image_url data URL），
 * 所以 base_url / api_key / model 都由使用者自己填，官方 OpenAI 之外的中转网关也能用。
 * 识别出的文字最终会作为「学生作答」交给 Jev 判分，图片本身不会存进 localStorage。
 */

export interface VisionSettings {
  /** OpenAI 兼容地址，可填 https://api.openai.com、.../v1 或完整 .../chat/completions。 */
  baseUrl: string
  model: string
  apiKey: string
  /** 识别完成后自动把文字交给 Jev 批改本题。 */
  autoGrade: boolean
}

export interface VisionImage {
  /** data:image/...;base64,... —— 直接塞进 image_url.url。 */
  dataUrl: string
  name?: string
}

export interface VisionUsage {
  input_tokens?: number
  output_tokens?: number
}

/** 一次截图识别留存的元信息（不包含图片本身）。 */
export interface ScreenshotTranscript {
  id: string
  questionId: string
  /** 识别出的作答文字；空字符串表示截图里没有可辨认的作答。 */
  text: string
  model: string
  fileNames: string[]
  elapsedMs: number
  at: string
  usage?: VisionUsage
  /** 实际请求的接口地址，便于排查是直连还是走了内置代理。 */
  endpoint?: string
}

export interface VisionCallResult {
  text: string
  model?: string
  usage?: VisionUsage
  elapsedMs: number
  url: string
  requestBody: unknown
  responseBody: unknown
}