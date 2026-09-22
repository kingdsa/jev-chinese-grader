/**
 * 判分引擎：把「标准答案 + 得分点 + 满分」编译成 Jev 的类型化问题，
 * 再把 Jev 的类型化答案用代码里的权重合成最终得分。
 *
 * 设计要点（来自 TypeSafe 官方文档的最佳实践）：
 * - 每个得分点是一个独立的 Noul 命题，而不是让模型做长推理；
 * - 整体质量用 Score 原语（档位描述而不是数字），返回的 score 是「档位位置」，
 *   需要除以 (档位数 - 1) 归一化到 0~1，再乘以本题满分；
 * - 选择题用 Choice 原语直接判定选项；
 * - 分数融合、四舍五入、裁剪全部发生在代码里，权重显式可见、可调。
 */

import { alignAnswers, askJev, JevError, type JevCallResult } from './jev'
import type { GradingOptions, JevAnswers, JevQuestions, JevSettings } from '../types/jev'
import type { ExamQuestion, GradingResult, QualityOutcome, RubricOutcome, SubjectProfile } from '../types/exam'

/** 未显式传科目时的兜底（语文），保证单独调用判分引擎也能工作。 */
export const DEFAULT_SUBJECT_PROFILE: SubjectProfile = {
  id: 'chinese',
  label: '语文',
  promptLabel: 'Chinese language',
  blurb: '',
}

export const DEFAULT_GRADING_OPTIONS: GradingOptions = {
  strategy: 'blend',
  rubricWeight: 0.7,
  hitThreshold: 0.6,
  reviewBand: 0.12,
  reviewConfidence: 0.45,
  mismatchTolerance: 0.35,
  rounding: 'half',
  choiceMinConfidence: 0.5,
}

export interface GradingInput {
  question: ExamQuestion
  maxScore: number
  studentAnswer: string
  settings: JevSettings
  options: GradingOptions
  /** 所属科目：决定 state.subject 与判分 instructions 的学科措辞。 */
  subject?: SubjectProfile
  signal?: AbortSignal
}

const RUBRIC_KEY = (index: number) => `p_${index}`
const QUALITY_KEY = 'quality'
const CHOICE_KEY = 'pick'
const ATTEMPT_KEY = 'attempt'

export function isBlankAnswer(answer: string): boolean {
  return answer.replace(/\s|\u3000/g, '').length === 0
}

/** 构造发给 Jev 的 state：中文原文 + 结构化字段；instructions 用英文（模型最稳）。 */
export function buildRequestState(
  question: ExamQuestion,
  maxScore: number,
  studentAnswer: string,
  subject: SubjectProfile = DEFAULT_SUBJECT_PROFILE,
) {
  const answerLength = studentAnswer.replace(/\s|\u3000/g, '').length
  return {
    subject: subject.label,
    subject_id: subject.id,
    question_number: question.no,
    question_type: question.kindLabel,
    max_score: maxScore,
    question: question.material ? `${question.stem}\n\n【阅读材料】\n${question.material}` : question.stem,
    reference_answer: question.standardAnswer,
    rubric_points: question.rubric.map((point) => ({
      point: point.label,
      weight: point.weight,
      ...(point.detail ? { boundary: point.detail } : {}),
    })),
    ...(question.gradingNotes ? { grading_notes: question.gradingNotes } : {}),
    student_answer: studentAnswer,
    student_answer_length: answerLength,
    choice_options: question.choice ? question.choice.options : undefined,
  }
}

export function buildRequestQuestions(
  question: ExamQuestion,
  maxScore: number,
  subject: SubjectProfile = DEFAULT_SUBJECT_PROFILE,
): JevQuestions {
  const questions: JevQuestions = {}

  question.rubric.forEach((point, index) => {
    questions[RUBRIC_KEY(index)] = {
      type: 'noul',
      instructions:
        `The student's answer to this ${subject.promptLabel} exam question earns this scoring point: "${point.label}". ` +
        'Judge this scoring point on its own, comparing the student answer with the reference answer. ' +
        'Answer yes only when the student answer actually provides the required content or achievement; ' +
        'do not answer yes for merely mentioning the topic, using similar wording, or writing a lot.' +
        (subject.guidance ? ` Subject-specific rules: ${subject.guidance}` : ''),
      criteria: {
        true: point.detail
          ? `算得分：${point.detail}`
          : `算得分：学生作答准确、完整地体现了「${point.label}」`,
        false: `不算得分：学生作答未体现「${point.label}」，或表述明显错误、含关键错别字、答非所问`,
      },
    }
  })

  questions[ATTEMPT_KEY] = {
    type: 'noul',
    instructions:
      'Is the student answer a genuine attempt that directly addresses this question and refers to the requested content ' +
      '(rather than blank, copying the question stem, or completely off-topic)?',
    criteria: {
      true: '算作有效作答：学生答案正面回应该题，内容与题目相关',
      false: '不算有效作答：空白、照抄题干、明显跑题或与题目无关',
    },
  }

  questions[QUALITY_KEY] = {
    type: 'score',
    instructions:
      `For this ${subject.promptLabel} question: how well does the student answer match the reference answer, ` +
      `in terms of the scoring content required by a maximum of ${maxScore} points? ` +
      'Judge content only: how much of the required scoring content is present and how accurate it is. ' +
      'Do not reward or punish length, handwriting, or effort, and ignore the numeric score itself.',
    criteria: question.levels.slice(0, 10),
  }

  if (question.choice) {
    questions[CHOICE_KEY] = {
      type: 'choice',
      instructions:
        "Which option does the student's answer select for this multiple-choice question? " +
        'Choose the option the student actually picked; if the answer names no option, choose the option the student\'s reasoning best matches.',
      criteria: question.choice.options,
    }
  }

  return questions
}

/* ------------------------------------------------------------------ */
/* 分数合成                                                            */
/* ------------------------------------------------------------------ */

export function roundScore(value: number, mode: GradingOptions['rounding']): number {
  if (!Number.isFinite(value)) return 0
  if (mode === 'int') return Math.round(value)
  if (mode === 'half') return Math.round(value * 2) / 2
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function requestQuestions(call: JevCallResult): JevQuestions {
  return (call.requestBody as { questions?: JevQuestions }).questions ?? {}
}

function pickQuality(answers: JevAnswers, question: ExamQuestion): QualityOutcome | null {
  const answer = answers[QUALITY_KEY]
  if (!answer || answer.type !== 'score') return null
  const levels = Math.max(question.levels.length - 1, 1)
  const ratio = clamp(answer.score / levels, 0, 1)
  return {
    raw: answer.score,
    ratio,
    confidence: Number.isFinite(answer.confidence) ? answer.confidence : 0,
    legend: answer.legend ?? {},
    probabilities: answer.probabilities ?? {},
  }
}

function buildResult(
  input: GradingInput,
  call: JevCallResult,
  blank: boolean,
): GradingResult {
  const { question, maxScore, options } = input
  const typed = alignAnswers(requestQuestions(call), call.answers)

  const totalWeight = question.rubric.reduce((sum, point) => sum + point.weight, 0)
  const rubric: RubricOutcome[] = question.rubric.map((point, index) => {
    const answer = typed.noul[RUBRIC_KEY(index)]
    const noul = answer ? clamp(answer.noul, 0, 1) : 0
    return {
      point,
      hit: noul >= options.hitThreshold,
      noul,
      uncertain: Math.abs(noul - 0.5) < options.reviewBand,
      earned: 0,
    }
  })

  const hitWeight = rubric.reduce((sum, item) => sum + (item.hit ? item.point.weight : 0), 0)
  const rubricScore = totalWeight > 0 ? maxScore * (hitWeight / totalWeight) : null
  if (rubricScore !== null) {
    for (const item of rubric) {
      item.earned = maxScore * ((item.hit ? item.point.weight : 0) / totalWeight)
    }
  }

  const quality = pickQuality(call.answers, question)
  const directScore = quality ? maxScore * quality.ratio : null

  const rawChoice = typed.choice[CHOICE_KEY]
  const choice = question.choice
    ? {
        picked: rawChoice?.choice ?? '?',
        correct: question.choice.correct,
        matched: rawChoice?.choice === question.choice.correct,
        confidence: rawChoice?.confidence ?? 0,
        probabilities: rawChoice?.probabilities ?? {},
      }
    : null

  // 融合：选择题只按选项判定；其他题型按策略融合「得分点覆盖率」与「整体档位分」。
  let blendedRaw: number
  if (choice) {
    blendedRaw = choice.matched ? maxScore : 0
  } else if (options.strategy === 'rubric' && rubricScore !== null) {
    blendedRaw = rubricScore
  } else if (options.strategy === 'direct' && directScore !== null) {
    blendedRaw = directScore
  } else if (rubricScore !== null && directScore !== null) {
    blendedRaw = options.rubricWeight * rubricScore + (1 - options.rubricWeight) * directScore
  } else {
    blendedRaw = rubricScore ?? directScore ?? 0
  }

  const attempt = typed.noul[ATTEMPT_KEY]
  const attemptNoul = attempt ? attempt.noul : 1

  const reviewReasons: string[] = []
  const notes: string[] = []

  for (const issue of typed.issues) reviewReasons.push(issue)

  const uncertainPoints = rubric.filter((item) => item.uncertain)
  if (uncertainPoints.length > 0) {
    reviewReasons.push(
      `得分点判定摇摆（noul 接近 0.5）：${uncertainPoints.map((item) => item.point.label).join('、')}`,
    )
  }
  if (quality && quality.confidence < options.reviewConfidence) {
    reviewReasons.push(`整体档位分置信度偏低（confidence=${quality.confidence.toFixed(2)}）`)
  }
  if (choice && choice.confidence < options.choiceMinConfidence) {
    reviewReasons.push(`选项判定置信度偏低（confidence=${choice.confidence.toFixed(2)}）`)
  }
  if (
    rubricScore !== null &&
    directScore !== null &&
    Math.abs(rubricScore - directScore) >= maxScore * options.mismatchTolerance
  ) {
    reviewReasons.push(
      `得分点覆盖率与整体档位分差异较大（${rubricScore.toFixed(2)} vs ${directScore.toFixed(2)}）`,
    )
  }

  const missed = rubric.filter((item) => !item.hit)
  if (missed.length > 0) notes.push(`未命中得分点：${missed.map((item) => item.point.label).join('、')}`)
  if (!choice && attemptNoul < 0.3) notes.push('学生作答疑似未正面回应该题（Jev attempt 判定为否）')
  if (totalWeight > 0 && Math.abs(totalWeight - maxScore) > 0.001 && rubricScore !== null) {
    notes.push(`得分点权重合计 ${totalWeight}，已按权重占比折算到满分 ${maxScore} 分`)
  }

  const confidenceCandidates: number[] = []
  if (quality) confidenceCandidates.push(quality.confidence)
  if (choice) confidenceCandidates.push(choice.confidence)
  for (const item of rubric) confidenceCandidates.push(Math.abs(item.noul - 0.5) * 2)
  const confidence = confidenceCandidates.length ? Math.min(...confidenceCandidates) : 0

  const score = clamp(
    roundScore(blank ? 0 : blendedRaw, options.rounding),
    0,
    maxScore,
  )

  return {
    questionId: question.id,
    maxScore,
    score,
    blank,
    rubricScore,
    directScore,
    blendedRaw,
    rubric,
    quality,
    choice,
    confidence,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
    notes,
    model: call.model,
    usage: call.usage,
    elapsedMs: call.elapsedMs,
    requestState: (call.requestBody as { state?: unknown }).state,
    requestQuestions: (call.requestBody as { questions?: Record<string, unknown> }).questions ?? {},
    rawAnswers: call.answers,
  }
}

function blankResult(input: GradingInput): GradingResult {
  const { question, maxScore } = input
  return {
    questionId: question.id,
    maxScore,
    score: 0,
    blank: true,
    rubricScore: question.rubric.length ? 0 : null,
    directScore: null,
    blendedRaw: 0,
    rubric: question.rubric.map((point) => ({
      point,
      hit: false,
      noul: 0,
      uncertain: false,
      earned: 0,
    })),
    quality: null,
    choice: question.choice
      ? {
          picked: '?',
          correct: question.choice.correct,
          matched: false,
          confidence: 1,
          probabilities: {},
        }
      : null,
    confidence: 1,
    needsReview: false,
    reviewReasons: [],
    notes: ['学生答案为空，本地直接判 0 分（未调用 Jev）'],
    elapsedMs: 0,
    requestState: buildRequestState(question, maxScore, input.studentAnswer, input.subject),
    requestQuestions: {},
    rawAnswers: {},
  }
}

export async function gradeQuestion(input: GradingInput): Promise<GradingResult> {
  if (isBlankAnswer(input.studentAnswer)) return blankResult(input)

  const state = buildRequestState(input.question, input.maxScore, input.studentAnswer, input.subject)
  const questions = buildRequestQuestions(input.question, input.maxScore, input.subject)
  const call = await askJev(input.settings, state, questions, { signal: input.signal })
  return buildResult(input, call, false)
}

export function describeGradingError(error: unknown): string {
  if (error instanceof JevError) return error.message
  if (error instanceof DOMException && error.name === 'AbortError') return '已取消'
  return error instanceof Error ? error.message : String(error)
}

export { JevError }
export type { JevAnswers }