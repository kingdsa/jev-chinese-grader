import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EASYOCR_DEFAULT_ENDPOINT,
  normalizeEasyOcrEndpoint,
  normalizeEasyOcrWords,
  pingEasyOcr,
  prepareEasyOcrImages,
  resolveEasyOcrEndpoints,
  transcribeWithEasyOcr,
  wordsToText,
  EasyOcrError,
} from './easyocr'
import { VISION_DEFAULTS } from './vision'
import type { EasyOcrImage } from './easyocr'
import type { VisionSettings } from '../types/vision'

const settings: VisionSettings = {
  ...VISION_DEFAULTS,
  engine: 'easyocr',
  easyocrAccessKey: 'eocr_test',
}

const image: EasyOcrImage = { name: 'answer.png', blob: new Blob(['fake'], { type: 'image/png' }) }

function ocrPayload(texts: string[], extra: Record<string, unknown> = {}) {
  return {
    cost: 20,
    elapsed_seconds: 0.47,
    message: 'OCR 识别成功。',
    remaining_quota: 1073,
    request_id: 'req-1',
    result_summary: `识别到 ${texts.length} 个文字块`,
    words: texts.map((text, index) => ({
      text,
      rate: 0.99,
      left: 10 + index * 100,
      top: 10,
      right: 90 + index * 100,
      bottom: 40,
    })),
    ...extra,
  }
}

function mockOcrResponse(payload: unknown, status = 200) {
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

describe('端点归一化与选择', () => {
  it('空地址回落到官方接口，结尾斜杠会被去掉', () => {
    expect(normalizeEasyOcrEndpoint('  ')).toBe(EASYOCR_DEFAULT_ENDPOINT)
    expect(normalizeEasyOcrEndpoint('https://console.easyocr.org/api/ocr/')).toBe(
      'https://console.easyocr.org/api/ocr',
    )
  })

  it('官方地址 dev 先代理后直连，生产先直连；自定义地址只直连', () => {
    const dev = resolveEasyOcrEndpoints(EASYOCR_DEFAULT_ENDPOINT, true)
    expect(dev[0]).toEqual({ url: '/api/easyocr-proxy', label: '内置代理' })
    expect(dev[1]).toEqual({ url: EASYOCR_DEFAULT_ENDPOINT, label: '直连' })

    const prod = resolveEasyOcrEndpoints(EASYOCR_DEFAULT_ENDPOINT, false)
    expect(prod[0].label).toBe('直连')

    expect(resolveEasyOcrEndpoints('https://mirror.example.com/api/ocr', true)).toEqual([
      { url: 'https://mirror.example.com/api/ocr', label: '直连' },
    ])
    expect(resolveEasyOcrEndpoints('/api/easyocr-proxy', true)).toEqual([
      { url: '/api/easyocr-proxy', label: '同源' },
    ])
  })
})

describe('words[] → 文字', () => {
  it('按行聚类、行内按 x 排序，中英之间补空格', () => {
    const words = normalizeEasyOcrWords([
      { text: '第二行', left: 10, top: 60, right: 90, bottom: 90 },
      { text: '示例', left: 100, top: 10, right: 170, bottom: 40 },
      { text: 'EasyOCR', left: 10, top: 10, right: 90, bottom: 40 },
    ])
    expect(wordsToText(words)).toBe('EasyOCR 示例\n第二行')
  })

  it('中文块之间不插空格，空文本被忽略', () => {
    const words = normalizeEasyOcrWords([
      { text: '秋水', left: 10, top: 10, right: 50, bottom: 40 },
      { text: '共长天一色', left: 50, top: 10, right: 140, bottom: 40 },
      { text: '   ', left: 0, top: 0, right: 1, bottom: 1 },
    ])
    expect(wordsToText(words)).toBe('秋水共长天一色')
    expect(wordsToText([])).toBe('')
  })
})

describe('transcribeWithEasyOcr', () => {
  it('multipart 上传图片并按 X-Access-Key 鉴权，解析 words 与点数', async () => {
    const fetchMock = mockOcrResponse(ocrPayload(['秋水共长天一色']))

    const result = await transcribeWithEasyOcr({
      settings,
      images: [image],
      preferProxy: false,
    })

    expect(result.text).toBe('秋水共长天一色')
    expect(result.engine).toBe('easyocr')
    expect(result.model).toBe('easyocr')
    expect(result.usage).toEqual({ cost: 20, remaining_quota: 1073 })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(EASYOCR_DEFAULT_ENDPOINT)
    expect((init.headers as Record<string, string>)['X-Access-Key']).toBe('eocr_test')
    expect(init.method).toBe('POST')
    const form = init.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('access_key')).toBe('eocr_test')
    expect((form.get('file') as File).name).toBe('answer.png')
  })

  it('多张截图逐张识别，文字换行拼接、点数累加', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ocrPayload(['第一张'], { cost: 20, remaining_quota: 100 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ocrPayload(['第二张'], { cost: 10, remaining_quota: 90 }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await transcribeWithEasyOcr({
      settings,
      images: [image, { ...image, name: 'answer-2.png' }],
      preferProxy: false,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.text).toBe('第一张\n第二张')
    expect(result.usage).toEqual({ cost: 30, remaining_quota: 90 })
  })

  it('直连被 CORS 拦时自动改用内置代理', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ocrPayload(['代理可用']),
      } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const result = await transcribeWithEasyOcr({ settings, images: [image], preferProxy: false })

    expect(result.text).toBe('代理可用')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('/api/easyocr-proxy')
  })

  it('401 / 402 给出可操作的中文提示，且不再重试', async () => {
    const unauthorized = mockOcrResponse({ error: 'invalid_access_key' }, 401)
    await expect(
      transcribeWithEasyOcr({ settings, images: [image], preferProxy: false }),
    ).rejects.toThrow(/Access Key 无效/)
    expect(unauthorized).toHaveBeenCalledTimes(1)

    mockOcrResponse({ error: 'insufficient_credits', required_points: 20, remaining_quota: 3 }, 402)
    await expect(
      transcribeWithEasyOcr({ settings, images: [image], preferProxy: false }),
    ).rejects.toThrow(/点数不足（402）（本次需要 20 点，当前余额 3 点）/)
  })

  it('500 / 503 保留服务端原因（如错误码 -1），提示点数退还并退避重试', async () => {
    mockOcrResponse({ error: 'OCR 服务返回错误：OCR 识别失败，错误码: -1', request_id: 'req-9' }, 503)

    await expect(
      transcribeWithEasyOcr({ settings, images: [image], preferProxy: false, maxRetries: 0 }),
    ).rejects.toThrow(/当前不可用（503）：OCR 服务返回错误：OCR 识别失败，错误码: -1（request_id: req-9）/)

    const serverError = mockOcrResponse({ error: '系统内部处理失败' }, 500)
    await expect(
      transcribeWithEasyOcr({ settings, images: [image], preferProxy: false, maxRetries: 0 }),
    ).rejects.toThrow(/服务内部错误（500）：系统内部处理失败，预扣点数会自动退还/)
    expect(serverError).toHaveBeenCalledTimes(1)
  })

  it('5xx 默认退避重试两次（共 3 次请求）', async () => {
    const fetchMock = mockOcrResponse({ error: '系统内部处理失败' }, 500)

    await expect(
      transcribeWithEasyOcr({ settings, images: [image], preferProxy: false }),
    ).rejects.toThrow(/HTTP|服务内部错误/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('缺 Key 或图片时给出可读错误', async () => {
    await expect(
      transcribeWithEasyOcr({
        settings: { ...settings, easyocrAccessKey: '' },
        images: [image],
        preferProxy: false,
      }),
    ).rejects.toThrow('请先填写 EasyOCR Access Key')

    await expect(
      transcribeWithEasyOcr({ settings, images: [], preferProxy: false }),
    ).rejects.toThrow('请先上传答题截图')
  })
})

describe('pingEasyOcr', () => {
  it('用 1×1 小图验证 Key，并回报扣点与余额', async () => {
    const fetchMock = mockOcrResponse({ message: 'OCR 识别成功。', cost: 1, remaining_quota: 9999, words: [] })

    const result = await pingEasyOcr(settings, { preferProxy: false })

    expect(result.message).toBe('OCR 识别成功。')
    expect(result.cost).toBe(1)
    expect(result.remainingQuota).toBe(9999)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
  })
})

describe('prepareEasyOcrImages', () => {
  it('非图片与超量上传给出可读错误', async () => {
    await expect(prepareEasyOcrImages([new File(['x'], 'a.txt', { type: 'text/plain' })])).rejects.toThrow(
      /不是图片/,
    )
    const files = Array.from({ length: 5 }, (_, index) => new File(['x'], `a-${index}.png`, { type: 'image/png' }))
    await expect(prepareEasyOcrImages(files)).rejects.toThrow(/一次最多上传 4 张截图/)
  })

  it('浏览器不可用（测试环境）时原样返回文件', async () => {
    const images = await prepareEasyOcrImages([new File(['x'], 'a.png', { type: 'image/png' })])
    expect(images).toEqual([{ name: 'a.png', blob: expect.any(Blob) }])
  })

  it('EasyOcrError 带 status / retryable 标记', () => {
    const error = new EasyOcrError('x', { status: 503, retryable: true })
    expect(error.status).toBe(503)
    expect(error.retryable).toBe(true)
  })
})