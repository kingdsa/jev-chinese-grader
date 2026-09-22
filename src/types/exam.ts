/** 题库与判分结果的数据结构。 */

export type SubjectId =
  | 'chinese'
  | 'math'
  | 'chemistry'
  | 'biology'
  | 'english'
  | 'geography'
  | 'history'

/**
 * 科目配置：决定 Jev state 里的 subject 字段、
 * 判分 instructions 的学科措辞，以及该学科的特殊判分约定。
 */
export interface SubjectProfile {
  id: SubjectId
  /** 中文科目名，界面展示用，同时写进 Jev state.subject。 */
  label: string
  /** 科目英文名/题型名，拼进 Jev instructions（模型对英文指令更稳）。 */
  promptLabel: string
  /** 一句话说明该科目批改特点，展示在科目页。 */
  blurb: string
  /** 学科特殊判分约定，会追加到每个得分点的 instructions。 */
  guidance?: string
}

export interface RubricPoint {
  id: string
  /** 得分点描述，直接作为 Jev 的判定命题。 */
  label: string
  /** 该得分点「算得分 / 不算得分」的边界说明，可选。 */
  detail?: string
  /** 权重（可理解成分值），最终按 权重占比 × 满分 折算。 */
  weight: number
}

export interface DemoAnswer {
  /** 演示按钮文案，例如「满分示例」「中等示例」「零分示例」。 */
  label: string
  content: string
}

/** 内置的演示学生作答截图（放在 public/ 下，界面上一键载入并识别）。 */
export interface DemoScreenshot {
  /** 演示按钮文案，例如「演示截图（手写解答）」。 */
  label: string
  /** public/ 下的路径，例如 /demo/math-q10-answer.jpg。 */
  src: string
}

export interface ChoiceSetup {
  /** 选项：选项号 -> 选项内容。 */
  options: Record<string, string>
  /** 正确选项号。 */
  correct: string
}

export interface ExamQuestion {
  id: string
  no: number
  /** 题型标签，例如「古诗文默写」。 */
  kindLabel: string
  stem: string
  /** 阅读材料，可选。 */
  material?: string
  standardAnswer: string
  /** 评分说明（给 Jev 的补充说明，也会展示在界面上）。 */
  gradingNotes?: string
  defaultMaxScore: number
  rubric: RubricPoint[]
  /** Jev Score 原语的档位描述（2~10 档），从低到高。 */
  levels: string[]
  /** 选择题才有：交给 Jev Choice 原语判选项。 */
  choice?: ChoiceSetup
  demoAnswers: DemoAnswer[]
  /** 该题自带的学生作答截图示例，用户也可以换成自己上传的。 */
  demoScreenshot?: DemoScreenshot
}

export interface RubricOutcome {
  point: RubricPoint
  hit: boolean
  noul: number
  uncertain: boolean
  /** 该得分点实际贡献的分数。 */
  earned: number
}

export interface ChoiceOutcome {
  picked: string
  correct: string
  matched: boolean
  confidence: number
  probabilities: Record<string, number>
}

export interface QualityOutcome {
  /** Jev 返回的档位位置分（可能是小数）。 */
  raw: number
  /** 归一化到 0~1 的比例。 */
  ratio: number
  confidence: number
  legend: Record<string, string>
  probabilities: Record<string, number>
}

/** 学生作答的来源：手动输入，还是由答题截图识别而来。 */
export interface AnswerSource {
  kind: 'screenshot'
  /** 识图模型名。 */
  model: string
  fileNames: string[]
  elapsedMs: number
  at: string
}

export interface GradingResult {
  questionId: string
  maxScore: number
  /** 最终得分（已按策略融合、四舍五入并裁剪到 [0, maxScore]）。 */
  score: number
  blank: boolean
  rubricScore: number | null
  directScore: number | null
  blendedRaw: number
  rubric: RubricOutcome[]
  quality: QualityOutcome | null
  choice: ChoiceOutcome | null
  confidence: number
  needsReview: boolean
  reviewReasons: string[]
  notes: string[]
  model?: string
  usage?: { input_tokens?: number; output_tokens?: number }
  elapsedMs: number
  /** 作答来自截图识别时记录来源（手动输入为 null）。 */
  answerSource: AnswerSource | null
  /** 便于界面展示与调试的原始请求 / 响应。 */
  requestState: unknown
  requestQuestions: Record<string, unknown>
  rawAnswers: Record<string, unknown>
}