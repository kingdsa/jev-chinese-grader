import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHINESE_QUESTIONS } from '../data/subjects/chinese'
import { subjectById } from '../data/subjects'
import {
  buildVisionPrompt,
  buildVisionRequestBody,
  describeVisionError,
  extractVisionText,
  normalizeVisionEndpoint,
  resolveVisionEndpoints,
  splitChatCompletionsUrl,
  transcribeAnswerImages,
  VISION_DEFAULTS,
  VISION_TIMEOUT_MS,
  VisionError,
} from './vision'
import type { ExamQuestion } from '../types/exam'
import type { VisionSettings } from '../types/vision'

const question: ExamQuestion = CHINESE_QUESTIONS[0]
const settings: VisionSettings = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: 'sk-test',
  autoGrade: true,
}

const image = { dataUrl: 'data:image/jpeg;base64,AAAA', name: 'answer.jpg' }

function visionPayload(content: string) {
  return {
    model: 'gpt-4o-mini-2024-07-18',
    choices: [{ index: 0, message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 1200, completion_tokens: 24 },
  }
}

function mockVisionResponse(payload: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('识图端点归一化', () => {
  it('允许填域名、/v1 或完整 chat/completions', () => {
    expect(normalizeVisionEndpoint('https://api.openai.com')).toBe('https://api.openai.com/v1/chat/completions')
    expect(normalizeVisionEndpoint('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1/chat/completions',
    )
    expect(normalizeVisionEndpoint('https://gateway.example.com/compatible-mode/v1')).toBe(
      'https://gateway.example.com/compatible-mode/v1/chat/completions',
    )
    expect(normalizeVisionEndpoint('https://x.example.com/v1/chat/completions')).toBe(
      'https://x.example.com/v1/chat/completions',
    )
    expect(normalizeVisionEndpoint('/api/vision-proxy/v1')).toBe('/api/vision-proxy/v1/chat/completions')
    expect(normalizeVisionEndpoint('  ')).toBe('')
  })

  it('拆出网关根地址与路径，供内置代理使用', () => {
    expect(splitChatCompletionsUrl('https://api.openai.com/v1/chat/completions')).toEqual({
      target: 'https://api.openai.com/v1',
      path: '/chat/completions',
    })
    expect(splitChatCompletionsUrl('https://x.example.com/chat/completions?api-version=1')).toEqual({
      target: 'https://x.example.com',
      path: '/chat/completions?api-version=1',
    })
    expect(splitChatCompletionsUrl('/api/vision-proxy/v1/chat/completions')).toEqual({
      target: '/api/vision-proxy/v1',
      path: '/chat/completions',
    })
  })

  it('开发环境先代理后直连，生产环境先直连', () => {
    const dev = resolveVisionEndpoints('https://api.openai.com/v1', true)
    expect(dev[0]).toEqual({
      url: '/api/vision-proxy/chat/completions',
      target: 'https://api.openai.com/v1',
      label: '内置代理',
    })
    expect(dev[1].url).toBe('https://api.openai.com/v1/chat/completions')

    const prod = resolveVisionEndpoints('https://api.openai.com/v1', false)
    expect(prod[0].label).toBe('直连')

    const sameOrigin = resolveVisionEndpoints('/api/vision-proxy/v1')
    expect(sameOrigin).toEqual([{ url: '/api/vision-proxy/v1/chat/completions', label: '同源' }])
    expect(resolveVisionEndpoints('')).toEqual([])
  })
})

describe('extractVisionText', () => {
  it('去掉代码块与「识别结果：」抬头', () => {
    expect(extractVisionText(visionPayload('```text\n秋水共长天一色\n```'))).toBe('秋水共长天一色')
    expect(extractVisionText(visionPayload('识别结果：答案是 $\\frac{1}{2}$'))).toBe('答案是 $\\frac{1}{2}$')
  })

  it('NO_ANSWER 归一化为空字符串', () => {
    expect(extractVisionText(visionPayload('NO_ANSWER'))).toBe('')
    expect(extractVisionText(visionPayload('no answer'))).toBe('')
  })

  it('支持数组形式的 content，并校验 choices', () => {
    expect(
      extractVisionText({
        choices: [{ message: { content: [{ type: 'text', text: '甲' }, { type: 'text', text: '乙' }] } }],
      }),
    ).toBe('甲乙')
    expect(() => extractVisionText({ choices: [] })).toThrow(VisionError)
  })
})

describe('transcribeAnswerImages', () => {
  it('把题目上下文与图片 data URL 发给 chat/completions，并解析出文字', async () => {
    const fetchMock = mockVisionResponse(visionPayload('秋水共长天一色'))

    const result = await transcribeAnswerImages({
      settings,
      images: [image],
      question,
      subject: subjectById('chinese'),
      preferProxy: false,
    })

    expect(result.text).toBe('秋水共长天一色')
    expect(result.model).toBe('gpt-4o-mini-2024-07-18')
    expect(result.usage).toEqual({ input_tokens: 1200, output_tokens: 24 })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.messages[0].role).toBe('system')
    const parts = body.messages[1].content
    expect(parts[0].type).toBe('text')
    expect(parts[0].text).toContain(question.stem)
    expect(parts[1]).toEqual({ type: 'image_url', image_url: { url: image.dataUrl } })
  })

  it('直连被 CORS 拦时自动改用内置代理（目标地址放请求头）', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => visionPayload('代理可用'),
      } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const result = await transcribeAnswerImages({
      settings,
      images: [image],
      question,
      preferProxy: false,
    })

    expect(result.text).toBe('代理可用')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe('/api/vision-proxy/chat/completions')
    expect((init.headers as Record<string, string>)['x-vision-target']).toBe('https://api.openai.com/v1')
  })

  it('HTTP 401 直接报错，不再尝试其它端点', async () => {
    const fetchMock = mockVisionResponse({ error: { message: 'Incorrect API key provided' } }, 401)

    await expect(
      transcribeAnswerImages({ settings, images: [image], question, preferProxy: false }),
    ).rejects.toThrow(/HTTP 401：Incorrect API key provided/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('缺少 Key 或图片时给出可读错误', async () => {
    await expect(
      transcribeAnswerImages({
        settings: { ...settings, apiKey: '' },
        images: [image],
        question,
        preferProxy: false,
      }),
    ).rejects.toThrow('请先填写识图模型的 API Key')

    await expect(
      transcribeAnswerImages({ settings, images: [], question, preferProxy: false }),
    ).rejects.toThrow('请先上传答题截图')
  })
})

describe('提示词与请求体', () => {
  it('识图默认超时是 2 分钟', () => {
    expect(VISION_TIMEOUT_MS).toBe(120_000)
  })

  it('给模型的上下文包含科目与题干，但绝不带标准答案', () => {
    const prompt = buildVisionPrompt(question, subjectById('chinese'))
    expect(prompt).toContain('语文')
    expect(prompt).toContain(question.stem)
    expect(prompt).not.toContain(question.standardAnswer)
  })

  it('请求体只用通用字段，图片按顺序排在文本之后', () => {
    const body = buildVisionRequestBody(VISION_DEFAULTS, [image, { dataUrl: 'data:image/png;base64,BB' }], '转写')
    expect(Object.keys(body).sort()).toEqual(['messages', 'model'])
    const parts = body.messages[1].content as Array<{ type: string; text?: string; image_url?: { url: string } }>
    expect(parts).toHaveLength(3)
    expect(parts.filter((part) => part.type === 'image_url')).toHaveLength(2)
  })
})

describe('describeVisionError', () => {
  it('取消与未知错误都有可读文案', () => {
    expect(describeVisionError(new DOMException('Aborted', 'AbortError'))).toBe('已取消')
    expect(describeVisionError(new VisionError('识图模型返回 HTTP 500'))).toBe('识图模型返回 HTTP 500')
  })
})