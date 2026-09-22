import type { ExamQuestion, SubjectId, SubjectProfile } from '../../types/exam'
import { BIOLOGY_QUESTIONS } from './biology'
import { CHEMISTRY_QUESTIONS } from './chemistry'
import { CHINESE_QUESTIONS } from './chinese'
import { ENGLISH_QUESTIONS } from './english'
import { GEOGRAPHY_QUESTIONS } from './geography'
import { HISTORY_QUESTIONS } from './history'
import { MATH_QUESTIONS } from './math'

export interface SubjectBank extends SubjectProfile {
  questions: ExamQuestion[]
}

export const SUBJECTS: SubjectBank[] = [
  {
    id: 'chinese',
    label: '语文',
    promptLabel: 'Chinese language',
    blurb: '默写、文言实词与翻译、古诗鉴赏、现代文阅读、病句修改、成语判断修改、仿写、微写作。',
    guidance:
      'For dictation and classical Chinese translation, a wrong or missing character that changes the meaning forfeits that point, while synonyms keeping the exact meaning count as correct. ' +
      'For appreciation and reading questions, a point is earned only when the student both names the technique/idea and applies it to the text; merely listing a technique earns nothing.',
    questions: CHINESE_QUESTIONS,
  },
  {
    id: 'math',
    label: '数学',
    promptLabel: 'mathematics',
    blurb: '集合与复数、函数与导数、立体几何、概率统计、数列、解三角形、圆锥曲线。',
    guidance:
      'Judge mathematics on correctness, not on form: any mathematically equivalent expression, unsimplified but correct result, or different valid method counts as fully correct. ' +
      'A scoring point is earned only when the required step, formula or value is actually present and correct; a correct final answer with no working still earns the answer point, and a correct method with a later arithmetic slip still earns the method point.',
    questions: MATH_QUESTIONS,
  },
  {
    id: 'chemistry',
    label: '化学',
    promptLabel: 'chemistry',
    blurb: '化学与生活、离子方程式、元素周期律、有机物、化工流程、化学平衡、实验探究。',
    guidance:
      'Chemical equations must use correct formulas and be balanced, but reasonable equivalent notation counts. ' +
      'For calculations, a correct method with a minor arithmetic slip still earns the method point. Pay attention to units, states and reaction conditions only where the scoring point explicitly requires them. ' +
      'Answers must use precise chemical terminology rather than everyday wording.',
    questions: CHEMISTRY_QUESTIONS,
  },
  {
    id: 'biology',
    label: '生物',
    promptLabel: 'biology',
    blurb: '细胞结构与功能、酶与代谢、遗传规律与基因定位、生命活动调节、生态系统实验。',
    guidance:
      'Biological terms must be accurate (for example gene versus chromosome, transcription versus translation, genotype versus phenotype). ' +
      'A point is earned only when the required term or causal step is present and used correctly; conceptually correct but vague descriptions may earn a point when the scoring point asks only for the idea, ' +
      'and experimental answers must include the required control, variable or expected result to earn the point.',
    questions: BIOLOGY_QUESTIONS,
  },
  {
    id: 'english',
    label: '英语',
    promptLabel: 'English writing',
    blurb: '只看作文：邀请、建议、申请、通知、道歉、投稿等应用文，读后续写与议论文写作。',
    guidance:
      'This is an English writing task: judge the content points and word count on the student text literally, and judge language quality (grammar, vocabulary, coherence) through the holistic quality level instead of separate scoring points. ' +
      'A required content point is earned only when the student actually expresses that idea (in correct or acceptable English); answers that copy the task text or a memorized template earn no point. ' +
      'For continuation writing, the plot must stay consistent with the given passages and characters to earn the content points.',
    questions: ENGLISH_QUESTIONS,
  },
  {
    id: 'geography',
    label: '地理',
    promptLabel: 'geography',
    blurb: '地球运动、大气与天气系统、水文与洋流、人口城市、农业工业区位、区域可持续发展。',
    guidance:
      'A geography point is earned only when the answer states the required factor together with a correct mechanism or cause-effect link (for example what changes and why). ' +
      'A bare list of place names, data or copied material earns nothing. Answers must use standard geographical terminology such as 地貌、气候、区位、产业结构 rather than vague wording.',
    questions: GEOGRAPHY_QUESTIONS,
  },
  {
    id: 'history',
    label: '历史',
    promptLabel: 'history',
    blurb: '古代政治制度、近代救亡图存、世界思想与制度、新中国建设、材料分析与观点论述。',
    guidance:
      'A history point is earned only when the answer names the event, institution or idea accurately and, where the scoring point requires it, explains its cause, content or impact. ' +
      'A name-drop without explanation does not earn a full point; an accurate but differently worded historical statement counts as correct, while anachronistic or chronologically wrong statements do not.',
    questions: HISTORY_QUESTIONS,
  },
]

export const DEFAULT_SUBJECT_ID: SubjectId = 'chinese'

export function subjectById(id: string): SubjectBank {
  return SUBJECTS.find((subject) => subject.id === id) ?? SUBJECTS[0]
}

export function totalMaxScoreOf(subject: SubjectBank, maxScores: Record<string, number> = {}): number {
  return subject.questions.reduce((sum, question) => sum + (maxScores[question.id] ?? question.defaultMaxScore), 0)
}