/**
 * 「答题截图 → 文字」的类型定义。
 *
 * 识别引擎二选一：
 * - `llm`：OpenAI 兼容的 Chat Completions 接口（messages + image_url data URL），
 *   base_url / api_key / model 都由使用者自己填，官方 OpenAI 之外的中转网关也能用；
 * - `easyocr`：EasyOCR 在线 OCR（https://easyocr.org/zh/quick-start），
 *   只需填控制台创建的 X-Access-Key，multipart/form-data 上传图片。
 *
 * 识别出的文字最终会作为「学生作答」交给 Jev 判分，图片本身不会存进 localStorage。
 */

export type VisionEngine = 'llm' | 'easyocr'

export interface VisionSettings {
  /** 识别引擎，二选一：OpenAI 兼容视觉模型 / EasyOCR 在线 OCR。 */
  engine: VisionEngine
  /** OpenAI 兼容地址，可填 https://api.openai.com、.../v1 或完整 .../chat/completions。 */
  baseUrl: string
  model: string
  apiKey: string
  /** EasyOCR 控制台创建的 Access Key（X-Access-Key，形如 eocr_...）。 */
  easyocrAccessKey: string
  /** EasyOCR 接口地址，默认官方 https://console.easyocr.org/api/ocr。 */
  easyocrEndpoint: string
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
  /** EasyOCR：本次识别实际扣除的点数。 */
  cost?: number
  /** EasyOCR：扣除后的账户剩余点数。 */
  remaining_quota?: number
}

/** 一次截图识别留存的元信息（不包含图片本身）。 */
export interface ScreenshotTranscript {
  id: string
  questionId: string
  /** 识别出的作答文字；空字符串表示截图里没有可辨认的作答。 */
  text: string
  /** 实际使用的识别引擎。 */
  engine?: VisionEngine
  /** 识图模型名，或 EasyOCR（引擎为 easyocr 时固定为 easyocr）。 */
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
  engine: VisionEngine
  model?: string
  usage?: VisionUsage
  elapsedMs: number
  url: string
  requestBody: unknown
  responseBody: unknown
}