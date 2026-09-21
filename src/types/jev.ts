/**
 * TypeSafe Jev（System One）类型定义。
 *
 * Jev 只返回三种「类型化答案」，代码可以直接分支使用，不需要解析自然语言：
 * - noul   : 命题成立的概率（0~1）
 * - choice : 从若干候选中选一个，附 probabilities + confidence
 * - score  : 落在有序档位上的位置分（0 ~ 档位数-1），附 probabilities + confidence
 */

export type JevQuestionType = 'noul' | 'choice' | 'score'

export interface JevNoulCriteria {
  true?: string
  false?: string
}

export interface JevNoulQuestion {
  type: 'noul'
  instructions: string
  criteria?: JevNoulCriteria
}

export interface JevChoiceQuestion {
  type: 'choice'
  instructions: string
  criteria: Record<string, string | null>
}

export interface JevScoreQuestion {
  type: 'score'
  instructions: string
  criteria: string[]
}

export type JevQuestion = JevNoulQuestion | JevChoiceQuestion | JevScoreQuestion

export type JevQuestions = Record<string, JevQuestion>

export interface JevNoulAnswer {
  type: 'noul'
  noul: number
}

export interface JevChoiceAnswer {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Record<string, number>
}

export interface JevScoreAnswer {
  type: 'score'
  score: number
  confidence: number
  legend: Record<string, string>
  probabilities: Record<string, number>
}

export type JevAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer

export type JevAnswers = Record<string, JevAnswer>

export interface JevUsage {
  input_tokens?: number
  output_tokens?: number
}

export interface JevResponse {
  model?: string
  answers: JevAnswers
  usage?: JevUsage
}

export interface JevSettings {
  baseUrl: string
  model: string
  apiKey: string
}

export type GradingStrategy = 'blend' | 'rubric' | 'direct'

export type RoundingMode = 'int' | 'half' | 'none'

/** 判分策略：作为「代码里的权重」显式写在类型里，便于随时调整。 */
export interface GradingOptions {
  strategy: GradingStrategy
  /** blend 策略中「得分点覆盖率」所占权重（0~1），其余给 Jev 整体档位分。 */
  rubricWeight: number
  /** noul >= hitThreshold 视为该得分点命中。 */
  hitThreshold: number
  /** |noul - 0.5| < reviewBand 视为判定摇摆，需要人工复核。 */
  reviewBand: number
  /** score/choice 的 confidence 低于该值时提示人工复核。 */
  reviewConfidence: number
  /** 两个得分点之间的分差达到 maxScore * mismatchTolerance 时提示复核。 */
  mismatchTolerance: number
  rounding: RoundingMode
  /** choice 题的选项判定最低置信度。 */
  choiceMinConfidence: number
}