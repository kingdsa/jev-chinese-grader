import { useCallback, useMemo, useRef, useState } from 'react'
import { QuestionCard } from './components/QuestionCard'
import { SettingsPanel } from './components/SettingsPanel'
import { SubjectTabs } from './components/SubjectTabs'
import { SummaryBar } from './components/SummaryBar'
import { DEFAULT_SUBJECT_ID, SUBJECTS, subjectById } from './data/subjects'
import { usePersistentState } from './hooks/usePersistentState'
import { formatScore } from './lib/format'
import { askJev, isJevConfigured, isNoulAnswer, JEV_DEFAULTS } from './lib/jev'
import { DEFAULT_GRADING_OPTIONS, describeGradingError, gradeQuestion } from './lib/grading'
import type { ExamQuestion, GradingResult, RubricPoint } from './types/exam'
import type { GradingOptions, JevSettings } from './types/jev'

const EMPTY_RESULTS: Record<string, GradingResult> = {}
const EMPTY_ERRORS: Record<string, string> = {}
const EMPTY_RUNNING: Record<string, boolean> = {}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item === undefined) break
      await worker(item)
    }
  })
  await Promise.all(runners)
}

export default function App() {
  const [settings, setSettings] = usePersistentState<JevSettings>('jev.settings', JEV_DEFAULTS)
  const [options, setOptions] = usePersistentState<GradingOptions>('jev.options', DEFAULT_GRADING_OPTIONS)
  const [subjectId, setSubjectId] = usePersistentState<string>('jev.subject', DEFAULT_SUBJECT_ID)
  const [answers, setAnswers] = usePersistentState<Record<string, string>>('jev.answers', {})
  const [maxScores, setMaxScores] = usePersistentState<Record<string, number>>('jev.maxScores', {})
  const [rubrics, setRubrics] = usePersistentState<Record<string, RubricPoint[]>>('jev.rubrics', {})
  const [results, setResults] = usePersistentState<Record<string, GradingResult>>('jev.results', EMPTY_RESULTS)
  const [errors, setErrors] = useState<Record<string, string>>(EMPTY_ERRORS)
  const [running, setRunning] = useState<Record<string, boolean>>(EMPTY_RUNNING)
  const [settingsOpen, setSettingsOpen] = useState(() => !isJevConfigured(JEV_DEFAULTS))
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const controllerRef = useRef<AbortController | null>(null)

  const configured = isJevConfigured(settings)
  const activeSubject = useMemo(() => subjectById(subjectId), [subjectId])
  const bank = activeSubject.questions
  const rubricOf = useCallback(
    (question: ExamQuestion) => rubrics[question.id] ?? question.rubric,
    [rubrics],
  )
  const maxScoreOf = useCallback(
    (question: ExamQuestion) => maxScores[question.id] ?? question.defaultMaxScore,
    [maxScores],
  )

  const totalMax = useMemo(
    () => bank.reduce((sum, question) => sum + maxScoreOf(question), 0),
    [bank, maxScoreOf],
  )
  const gradedResults = useMemo(
    () => bank.map((question) => results[question.id]).filter((item): item is GradingResult => Boolean(item)),
    [bank, results],
  )
  const totalScore = useMemo(() => gradedResults.reduce((sum, item) => sum + item.score, 0), [gradedResults])
  const reviewCount = useMemo(() => gradedResults.filter((item) => item.needsReview).length, [gradedResults])
  const gradedCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const subject of SUBJECTS) {
      counts[subject.id] = subject.questions.filter((question) => results[question.id]).length
    }
    return counts
  }, [results])

  const gradeOne = useCallback(
    async (question: ExamQuestion) => {
      setRunning((prev) => ({ ...prev, [question.id]: true }))
      setErrors((prev) => ({ ...prev, [question.id]: '' }))
      if (!controllerRef.current) controllerRef.current = new AbortController()
      const signal = controllerRef.current.signal
      try {
        const result = await gradeQuestion({
          question,
          subject: activeSubject,
          maxScore: maxScoreOf(question),
          studentAnswer: answers[question.id] ?? '',
          settings,
          options,
          signal,
        })
        setResults((prev) => ({ ...prev, [question.id]: result }))
      } catch (error) {
        setErrors((prev) => ({ ...prev, [question.id]: describeGradingError(error) }))
      } finally {
        setRunning((prev) => ({ ...prev, [question.id]: false }))
      }
    },
    [activeSubject, answers, maxScoreOf, options, setResults, settings],
  )

  const gradeAll = useCallback(async () => {
    controllerRef.current = new AbortController()
    try {
      await runWithConcurrency([...bank], 2, gradeOne)
    } finally {
      controllerRef.current = null
    }
  }, [bank, gradeOne])

  const cancelAll = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  const testConnection = useCallback(async () => {
    setTesting(true)
    setTestMessage(null)
    try {
      const call = await askJev(
        settings,
        { probe: 'connection test from the multi-subject exam grading demo' },
        { ping: { type: 'noul', instructions: 'Is this a connection test?' } },
        { timeoutMs: 10_000, maxRetries: 0 },
      )
      const answer = call.answers.ping
      setTestMessage({
        ok: true,
        text: `连接成功：模型 ${call.model ?? settings.model}，ping=${
          isNoulAnswer(answer) ? answer.noul.toFixed(2) : '—'
        }，耗时 ${call.elapsedMs} ms`,
      })
    } catch (error) {
      setTestMessage({ ok: false, text: describeGradingError(error) })
    } finally {
      setTesting(false)
    }
  }, [settings])

  const exportResults = useCallback(() => {
    const payload = {
      generated_at: new Date().toISOString(),
      subject: activeSubject.label,
      subject_id: activeSubject.id,
      endpoint: `${settings.baseUrl.replace(/\/+$/, '')}/v1/systemone`,
      model: settings.model,
      grading_options: options,
      total_score: totalScore,
      total_max_score: totalMax,
      items: bank.map((question) => {
        const result = results[question.id]
        return {
          no: question.no,
          type: question.kindLabel,
          stem: question.stem,
          standard_answer: question.standardAnswer,
          student_answer: answers[question.id] ?? '',
          max_score: maxScoreOf(question),
          score: result?.score ?? null,
          needs_review: result?.needsReview ?? null,
          review_reasons: result?.reviewReasons ?? [],
          notes: result?.notes ?? [],
          rubric: (result?.rubric ?? []).map((item) => ({
            point: item.point.label,
            weight: item.point.weight,
            noul: item.noul,
            hit: item.hit,
            earned: item.earned,
          })),
          quality: result?.quality ?? null,
          choice: result?.choice ?? null,
          confidence: result?.confidence ?? null,
        }
      }),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `jev-grading-${activeSubject.id}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [
    activeSubject,
    answers,
    bank,
    maxScoreOf,
    options,
    results,
    settings.baseUrl,
    settings.model,
    totalMax,
    totalScore,
  ])

  const resetAll = useCallback(() => {
    const ids = new Set(bank.map((question) => question.id))
    setAnswers((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })
    setResults((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })
    setErrors((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })
    setTestMessage(null)
  }, [bank, setAnswers, setResults])

  const updateSettings = useCallback(
    (patch: Partial<JevSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  )
  const updateOptions = useCallback(
    (patch: Partial<GradingOptions>) => setOptions((prev) => ({ ...prev, ...patch })),
    [setOptions],
  )

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo">Jev</span>
          <div>
            <h1>多学科试卷 AI 评分演示</h1>
            <p>
              语文 · 数学 · 化学 · 生物 · 英语（作文）· 地理 · 历史 · TypeSafe Jev{' '}
              <code>noul</code> / <code>choice</code> / <code>score</code> 三原语判分
            </p>
          </div>
        </div>
        <div className="app__header-actions">
          <button className="btn" onClick={() => setSettingsOpen((open) => !open)}>
            {settingsOpen ? '收起接口设置' : '接口设置'}
          </button>
          <a className="btn btn--ghost" href="https://docs.typesafe.ai/" target="_blank" rel="noreferrer">
            Jev 文档
          </a>
          <a className="btn btn--ghost" href="https://console.typesafe.ai/keys" target="_blank" rel="noreferrer">
            获取 API Key
          </a>
        </div>
      </header>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          options={options}
          testing={testing}
          testMessage={testMessage}
          onSettingsChange={updateSettings}
          onOptionsChange={updateOptions}
          onTest={testConnection}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <SubjectTabs
        subjects={SUBJECTS}
        activeId={activeSubject.id}
        gradedCounts={gradedCounts}
        running={Object.values(running).some(Boolean)}
        onChange={setSubjectId}
      />

      <SummaryBar
        subjectLabel={activeSubject.label}
        totalScore={totalScore}
        totalMax={totalMax}
        gradedCount={gradedResults.length}
        questionCount={bank.length}
        reviewCount={reviewCount}
        running={Object.values(running).some(Boolean)}
        configured={configured}
        onGradeAll={gradeAll}
        onCancel={cancelAll}
        onExport={exportResults}
        onReset={resetAll}
      />

      <p className="subject-blurb">
        <b>{activeSubject.label}</b>：{activeSubject.blurb}　共 {bank.length} 道演示题，每题满分、评分要点都可以改。
      </p>

      <ol className="tips">
        <li>在「接口设置」里填入 API Key（只存在浏览器 localStorage，不会上传到任何服务器）。</li>
        <li>切换上方科目切换题库；每题点「演示作答」按钮填入示例答案，或自己输入。</li>
        <li>点「批改本题」看单题判定过程，或「一键批改全部」拿到本科总分并导出 JSON。</li>
      </ol>

      <main className="app__main">
        {bank.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            maxScore={maxScoreOf(question)}
            rubric={rubricOf(question)}
            answer={answers[question.id] ?? ''}
            result={results[question.id]}
            stale={Boolean(results[question.id]) && results[question.id].maxScore !== maxScoreOf(question)}
            error={errors[question.id]}
            running={Boolean(running[question.id])}
            configured={configured}
            onMaxScoreChange={(value) =>
              setMaxScores((prev) => ({ ...prev, [question.id]: Number.isFinite(value) ? Math.max(0, value) : 0 }))
            }
            onRubricChange={(rubric) => setRubrics((prev) => ({ ...prev, [question.id]: rubric }))}
            onAnswerChange={(value) => setAnswers((prev) => ({ ...prev, [question.id]: value }))}
            onGrade={() => void gradeOne(question)}
            onClear={() =>
              setResults((prev) => {
                const next = { ...prev }
                delete next[question.id]
                return next
              })
            }
          />
        ))}
      </main>

      <footer className="app__footer">
        <span>
          {activeSubject.label}总分 {formatScore(totalScore)} / {formatScore(totalMax)} ·
          判分全部在浏览器里完成，无后端
        </span>
        <span>
          评分逻辑：得分点 Noul 覆盖率 × 权重 + Jev 整体档位分（Score）按权重融合，再取整裁剪到 [0, 满分]
        </span>
      </footer>
    </div>
  )
}