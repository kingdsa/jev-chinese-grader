import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHINESE_QUESTIONS } from '../data/subjects/chinese'
import { subjectById } from '../data/subjects'
import { DEFAULT_GRADING_OPTIONS, buildRequestQuestions, gradeQuestion } from './grading'
import type { ExamQuestion, RubricPoint } from '../types/exam'
import type { GradingOptions, JevSettings } from '../types/jev'

const settings: JevSettings = { baseUrl: 'https://api.typesafe.ai', model: 'jev-latest', apiKey: 'ts-test' }

function questionById(id: string): ExamQuestion {
  const question = CHINESE_QUESTIONS.find((item) => item.id === id)
  if (!question) throw new Error(`missing question ${id}`)
  return question
}

function mockAnswers(answers: Record<string, unknown>) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ model: 'jev-test', answers, usage: { input_tokens: 1, output_tokens: 1 } }),
  } as unknown as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('gradeQuestion 判分链路', () => {
  it('空白作答直接判 0，不调用 Jev', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await gradeQuestion({
      question: questionById('q1'),
      maxScore: 2,
      studentAnswer: '   ',
      settings,
      options: DEFAULT_GRADING_OPTIONS,
    })

    expect(result.score).toBe(0)
    expect(result.blank).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('得分点全命中 + 档位满分 → 拿到满分（blend 策略）', async () => {
    const fetchMock = mockAnswers({
      p_0: { type: 'noul', noul: 0.98 },
      p_1: { type: 'noul', noul: 0.95 },
      attempt: { type: 'noul', noul: 0.99 },
      quality: {
        type: 'score',
        score: 2,
        confidence: 0.95,
        legend: { '0': '低', '1': '中', '2': '高' },
        probabilities: { '0': 0, '1': 0, '2': 1 },
      },
    })

    const result = await gradeQuestion({
      question: questionById('q1'),
      maxScore: 2,
      studentAnswer: '秋水共长天一色',
      settings,
      options: DEFAULT_GRADING_OPTIONS,
    })

    expect(result.score).toBe(2)
    expect(result.rubricScore).toBe(2)
    expect(result.directScore).toBe(2)
    expect(result.needsReview).toBe(false)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect((fetchMock.mock.calls[0][0] as string).endsWith('/v1/systemone')).toBe(true)
    expect(body.state.max_score).toBe(2)
    expect(body.questions.p_0.type).toBe('noul')
    expect(body.questions.quality.type).toBe('score')
  })

  it('按权重占比折算满分：权重合计 5 → 满分 4', async () => {
    mockAnswers({
      p_0: { type: 'noul', noul: 0.9 },
      p_1: { type: 'noul', noul: 0.9 },
      p_2: { type: 'noul', noul: 0.9 },
      p_3: { type: 'noul', noul: 0.9 },
      p_4: { type: 'noul', noul: 0.05 },
      p_5: { type: 'noul', noul: 0.1 },
      attempt: { type: 'noul', noul: 0.9 },
      quality: {
        type: 'score',
        score: 3.2,
        confidence: 0.7,
        legend: {},
        probabilities: {},
      },
    })

    const result = await gradeQuestion({
      question: questionById('q3'),
      maxScore: 4,
      studentAnswer: '认真地兴办学校的教育，把孝顺父母、敬爱兄长的道理反复讲给百姓听……',
      settings,
      options: { ...DEFAULT_GRADING_OPTIONS, strategy: 'rubric' },
    })

    // 命中权重 4 / 5 → 4 * 0.8 = 3.2 → 0.5 取整 3
    expect(result.rubricScore).toBeCloseTo(3.2, 5)
    expect(result.score).toBe(3)
    expect(result.notes.some((note) => note.includes('按权重占比折算'))).toBe(true)
  })

  it('noul 落在摇摆区间时提示人工复核', async () => {
    mockAnswers({
      p_0: { type: 'noul', noul: 0.5 },
      p_1: { type: 'noul', noul: 0.95 },
      attempt: { type: 'noul', noul: 0.9 },
      quality: { type: 'score', score: 1, confidence: 0.9, legend: {}, probabilities: {} },
    })

    const result = await gradeQuestion({
      question: questionById('q1'),
      maxScore: 2,
      studentAnswer: '秋水共长天一色',
      settings,
      options: DEFAULT_GRADING_OPTIONS,
    })

    expect(result.needsReview).toBe(true)
    expect(result.reviewReasons.join('')).toContain('摇摆')
  })

  it('Choice 原语仍可用：按选项判定，错选不得分并保留概率分布', async () => {
    // 演示题库已全部改为填空/解答题，这里用合成题保证 Choice 原语链路不回退。
    const choiceQuestion: ExamQuestion = {
      id: 'test-choice',
      no: 99,
      kindLabel: '选择题（仅测试用）',
      stem: '下列各句中成语使用不正确的一项是（　　）',
      standardAnswer: 'C',
      defaultMaxScore: 3,
      rubric: [],
      levels: ['没有作答', '选项错误', '选项正确'],
      choice: {
        options: { A: '正确', B: '正确', C: '错误', D: '正确' },
        correct: 'C',
      },
      demoAnswers: [
        { label: '满分示例', content: 'C' },
        { label: '中等示例', content: 'B' },
        { label: '零分示例', content: 'A' },
      ],
    }

    mockAnswers({
      attempt: { type: 'noul', noul: 0.95 },
      quality: { type: 'score', score: 1, confidence: 0.8, legend: {}, probabilities: {} },
      pick: {
        type: 'choice',
        choice: 'C',
        confidence: 0.91,
        probabilities: { A: 0.02, B: 0.05, C: 0.91, D: 0.02 },
      },
    })

    const result = await gradeQuestion({
      question: choiceQuestion,
      maxScore: 3,
      studentAnswer: 'C。',
      settings,
      options: DEFAULT_GRADING_OPTIONS,
    })

    expect(result.choice?.picked).toBe('C')
    expect(result.choice?.matched).toBe(true)
    expect(result.score).toBe(3)

    mockAnswers({
      attempt: { type: 'noul', noul: 0.9 },
      quality: { type: 'score', score: 1, confidence: 0.8, legend: {}, probabilities: {} },
      pick: { type: 'choice', choice: 'B', confidence: 0.8, probabilities: { B: 0.8 } },
    })

    const wrong = await gradeQuestion({
      question: choiceQuestion,
      maxScore: 3,
      studentAnswer: 'B。',
      settings,
      options: DEFAULT_GRADING_OPTIONS,
    })

    expect(wrong.score).toBe(0)
    expect(wrong.choice?.matched).toBe(false)
  })
})

describe('科目配置进入 Jev 请求', () => {
  it('数学题会带上 subject、学科英文措辞与学科判分约定', async () => {
    const math = subjectById('math')
    const question = math.questions[3]
    const fetchMock = mockAnswers({
      p_0: { type: 'noul', noul: 0.9 },
      p_1: { type: 'noul', noul: 0.9 },
      attempt: { type: 'noul', noul: 0.9 },
      quality: { type: 'score', score: 3, confidence: 0.9, legend: {}, probabilities: {} },
    })

    await gradeQuestion({
      question,
      subject: math,
      maxScore: question.defaultMaxScore,
      studentAnswer: '60',
      settings,
      options: DEFAULT_GRADING_OPTIONS,
    })

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.state.subject).toBe('数学')
    expect(body.state.subject_id).toBe('math')
    expect(body.questions.p_0.instructions).toContain('mathematics')
    expect(body.questions.p_0.instructions).toContain('mathematically equivalent')
    expect(body.questions.quality.instructions).toContain('mathematics')
  })

  it('不传 subject 时按语文兜底', async () => {
    const fetchMock = mockAnswers({
      p_0: { type: 'noul', noul: 0.9 },
      p_1: { type: 'noul', noul: 0.9 },
      attempt: { type: 'noul', noul: 0.9 },
      quality: { type: 'score', score: 2, confidence: 0.9, legend: {}, probabilities: {} },
    })

    await gradeQuestion({
      question: questionById('q1'),
      maxScore: 2,
      studentAnswer: '秋水共长天一色',
      settings,
      options: DEFAULT_GRADING_OPTIONS,
    })

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.state.subject).toBe('语文')
    expect(body.questions.p_0.instructions).toContain('Chinese language')
  })
})

describe('buildRequestQuestions 结构', () => {
  it('每个得分点生成一个 noul，并附带尝试作答与整体档位问题', () => {
    const question = questionById('q2')
    const questions = buildRequestQuestions(question, question.defaultMaxScore)
    const keys = Object.keys(questions)
    expect(keys).toEqual(['p_0', 'p_1', 'p_2', 'attempt', 'quality'])
    expect(questions.p_0).toMatchObject({ type: 'noul' })
    expect(questions.quality).toMatchObject({ type: 'score' })
    expect((questions.quality as { criteria: string[] }).criteria.length).toBeLessThanOrEqual(10)
  })

  it('自定义得分点权重会进入 state 的 rubric_points', async () => {
    const question = questionById('q1')
    const rubric: RubricPoint[] = [
      { id: 'custom-1', label: '自定义要点', weight: 3 },
      { id: 'custom-2', label: '自定义要点 2', weight: 1 },
    ]
    const fetchMock = mockAnswers({
      p_0: { type: 'noul', noul: 0.9 },
      p_1: { type: 'noul', noul: 0.9 },
      attempt: { type: 'noul', noul: 0.9 },
      quality: { type: 'score', score: 3, confidence: 0.9, legend: {}, probabilities: {} },
    })
    const options: GradingOptions = { ...DEFAULT_GRADING_OPTIONS, strategy: 'rubric' }

    const result = await gradeQuestion({
      question: { ...question, rubric },
      maxScore: 4,
      studentAnswer: '秋水共长天一色',
      settings,
      options,
    })

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.state.rubric_points).toEqual([
      { point: '自定义要点', weight: 3 },
      { point: '自定义要点 2', weight: 1 },
    ])
    expect(result.score).toBe(4)
  })

  it('答案类型与问题类型不匹配时记入复核提示，而不是崩溃', async () => {
    mockAnswers({
      p_0: { type: 'score', score: 1, confidence: 0.5, legend: {}, probabilities: {} },
      p_1: { type: 'noul', noul: 0.9 },
      attempt: { type: 'noul', noul: 0.9 },
      quality: { type: 'score', score: 1.5, confidence: 0.9, legend: {}, probabilities: {} },
    })

    const result = await gradeQuestion({
      question: questionById('q1'),
      maxScore: 2,
      studentAnswer: '秋水共长天一色',
      settings,
      options: DEFAULT_GRADING_OPTIONS,
    })

    expect(result.reviewReasons.some((reason) => reason.includes('期望 noul'))).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(2)
  })
})