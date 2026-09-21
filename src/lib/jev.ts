/**
 * TypeSafe Jev（System One）前端客户端。
 *
 * 官方 API：POST https://api.typesafe.ai/v1/systemone
 *   Authorization: Bearer <API_KEY>
 *   body: { state, model, questions }
 *
 * 这里做三件事：
 * 1. baseUrl 归一化（允许用户填 https://api.typesafe.ai 或带 /v1 或完整 /v1/systemone）
 * 2. 带重试 / 超时 / 可取消的请求
 * 3. 类型安全的答案读取：先做运行时类型校验，再用类型守卫收窄，拿到强类型字段
 */

import type {
  JevAnswer,
  JevAnswers,
  JevChoiceAnswer,
  JevNoulAnswer,
  JevQuestion,
  JevQuestions,
  JevResponse,
  JevScoreAnswer,
  JevSettings,
  JevUsage,
} from '../types/jev'

export const JEV_DEFAULTS: JevSettings = {
  /** 相对路径走 vite dev/preview 内置的同源代理，避免浏览器 CORS 拦截。 */
  baseUrl: '/api/typesafe',
  model: 'jev-latest',
  apiKey: '',
}

export const CORS_HINT =
  '浏览器直连 api.typesafe.ai 会被 CORS 拦截。把 Base URL 改成 /api/typesafe（npm run dev / preview 已内置同源代理），' +
  '或在你的域名下用 Nginx 把 /api/typesafe 反向代理到 https://api.typesafe.ai。'

/** 是否是「浏览器直连官方域名」这种会被 CORS 拦的写法。 */
export function isDirectTypesafeUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl.trim())
    return /(^|\.)typesafe\.ai$/i.test(url.hostname) && url.protocol !== 'file:'
  } catch {
    return false
  }
}

export function isCrossOriginFailure(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message))
  )
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529])
const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_MAX_RETRIES = 2

export interface JevCallOptions {
  signal?: AbortSignal
  timeoutMs?: number
  maxRetries?: number
}

export interface JevCallResult {
  answers: JevAnswers
  model?: string
  usage?: JevUsage
  elapsedMs: number
  url: string
  requestBody: unknown
  responseBody: unknown
}

export class JevError extends Error {
  readonly status?: number
  readonly retryable: boolean

  constructor(message: string, options: { status?: number; retryable?: boolean } = {}) {
    super(message)
    this.name = 'JevError'
    this.status = options.status
    this.retryable = options.retryable ?? false
  }
}

/** 允许填 https://api.typesafe.ai、https://api.typesafe.ai/v1 或完整 .../v1/systemone。 */
export function normalizeSystemOneUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/\/systemone$/i.test(trimmed)) return trimmed
  if (/\/v\d+$/i.test(trimmed)) return `${trimmed}/systemone`
  return `${trimmed}/v1/systemone`
}

export function isJevConfigured(settings: JevSettings): boolean {
  return Boolean(settings.apiKey.trim() && normalizeSystemOneUrl(settings.baseUrl))
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

export async function askJev(
  settings: JevSettings,
  state: unknown,
  questions: JevQuestions,
  options: JevCallOptions = {},
): Promise<JevCallResult> {
  const url = normalizeSystemOneUrl(settings.baseUrl)
  if (!url) throw new JevError('请先填写 Jev Base URL')
  if (!settings.apiKey.trim()) throw new JevError('请先填写 Jev API Key')

  const questionKeys = Object.keys(questions)
  if (questionKeys.length === 0) throw new JevError('没有可提交的问题')

  const requestBody = {
    state,
    model: settings.model.trim() || JEV_DEFAULTS.model,
    questions,
  }

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const startedAt = performance.now()
  let lastError: unknown = null

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey.trim()}`,
        },
        body: JSON.stringify(requestBody),
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        const retryable = RETRYABLE_STATUS.has(response.status)
        if (retryable && attempt < maxRetries) {
          const retryAfter = Number(response.headers.get('retry-after'))
          const waitMs =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, 3000)
              : 300 * 2 ** attempt
          await delay(waitMs, options.signal)
          continue
        }
        throw new JevError(`Jev 返回 HTTP ${response.status}${text ? `：${text.slice(0, 300)}` : ''}`, {
          status: response.status,
          retryable,
        })
      }

      const payload = (await response.json()) as JevResponse
      if (!payload || typeof payload !== 'object' || !payload.answers || typeof payload.answers !== 'object') {
        throw new JevError('Jev 响应缺少 answers 字段')
      }

      return {
        answers: payload.answers,
        model: payload.model,
        usage: payload.usage,
        elapsedMs: Math.round(performance.now() - startedAt),
        url,
        requestBody,
        responseBody: payload,
      }
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (isCrossOriginFailure(error)) {
        // 网络层直接失败（最常见就是 CORS），重试也没用，直接给出可操作的提示。
        throw new JevError(
          `请求 ${url} 失败（${error instanceof Error ? error.message : String(error)}）。${CORS_HINT}`,
          { retryable: false },
        )
      }
      lastError = error
      if (error instanceof JevError && !error.retryable) throw error
      if (attempt < maxRetries) {
        await delay(300 * 2 ** attempt, options.signal)
        continue
      }
    }
  }

  if (lastError instanceof JevError) throw lastError
  const reason = lastError instanceof Error ? lastError.message : String(lastError)
  throw new JevError(`Jev 请求失败：${reason}`, { retryable: true })
}

/* ------------------------------------------------------------------ */
/* 运行时类型校验 + 类型守卫（typesafe 读取答案）                       */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asProbabilityRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}
  const result: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    const num = asNumber(raw)
    if (num !== null) result[key] = num
  }
  return result
}

export function isNoulAnswer(answer: JevAnswer | undefined): answer is JevNoulAnswer {
  return answer?.type === 'noul' && asNumber((answer as JevNoulAnswer).noul) !== null
}

export function isChoiceAnswer(answer: JevAnswer | undefined): answer is JevChoiceAnswer {
  return answer?.type === 'choice' && typeof (answer as JevChoiceAnswer).choice === 'string'
}

export function isScoreAnswer(answer: JevAnswer | undefined): answer is JevScoreAnswer {
  return answer?.type === 'score' && asNumber((answer as JevScoreAnswer).score) !== null
}

export interface TypedAnswers {
  noul: Record<string, JevNoulAnswer>
  choice: Record<string, JevChoiceAnswer>
  score: Record<string, JevScoreAnswer>
  issues: string[]
}

/**
 * 把 answers 按问题类型归位。
 * 同时校验「问题类型 == 答案类型」，不匹配的会记入 issues —— 这就是运行时的类型安全网。
 */
export function alignAnswers(questions: JevQuestions, answers: JevAnswers): TypedAnswers {
  const typed: TypedAnswers = { noul: {}, choice: {}, score: {}, issues: [] }

  for (const [key, question] of Object.entries(questions)) {
    const answer = answers[key]

    if (!answer) {
      typed.issues.push(`问题「${key}」没有对应的答案`)
      continue
    }

    if (question.type === 'noul') {
      if (isNoulAnswer(answer)) typed.noul[key] = answer
      else typed.issues.push(`问题「${key}」期望 noul，实际是 ${answer.type}`)
    } else if (question.type === 'choice') {
      if (isChoiceAnswer(answer)) typed.choice[key] = answer
      else typed.issues.push(`问题「${key}」期望 choice，实际是 ${answer.type}`)
    } else if (question.type === 'score') {
      if (isScoreAnswer(answer)) {
        typed.score[key] = {
          ...answer,
          probabilities: asProbabilityRecord(answer.probabilities),
        }
      } else typed.issues.push(`问题「${key}」期望 score，实际是 ${answer.type}`)
    }
  }

  return typed
}

export function assertQuestionTypeMap(questions: Record<string, JevQuestion>): void {
  for (const [key, question] of Object.entries(questions)) {
    if (!question.instructions?.trim()) throw new Error(`问题「${key}」缺少 instructions`)
    if (question.type === 'choice' && Object.keys(question.criteria).length < 2) {
      throw new Error(`Choice 问题「${key}」至少需要 2 个候选`)
    }
    if (question.type === 'score' && (question.criteria.length < 2 || question.criteria.length > 10)) {
      throw new Error(`Score 问题「${key}」档位数必须在 2~10 之间`)
    }
  }
}