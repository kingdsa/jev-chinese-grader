import { useCallback, useMemo, useRef, useState } from 'react'
import { QuestionCard } from './components/QuestionCard'
import { SettingsPanel } from './components/SettingsPanel'
import { SubjectTabs } from './components/SubjectTabs'
import { SummaryBar } from './components/SummaryBar'
import { DEFAULT_SUBJECT_ID, SUBJECTS, subjectById } from './data/subjects'
import { usePersistentState } from './hooks/usePersistentState'
import { formatScore } from './lib/format'
import {
  describeEasyOcrError,
  normalizeEasyOcrEndpoint,
  pingEasyOcr,
  prepareEasyOcrImages,
  transcribeWithEasyOcr,
} from './lib/easyocr'
import { askJev, isJevConfigured, isNoulAnswer, JEV_DEFAULTS } from './lib/jev'
import { DEFAULT_GRADING_OPTIONS, describeGradingError, gradeQuestion } from './lib/grading'
import {
  buildTranscript,
  describeVisionError,
  isVisionConfigured,
  normalizeVisionEndpoint,
  parseVisionSettings,
  pingVision,
  prepareImageFiles,
  transcribeAnswerImages,
  VISION_DEFAULTS,
} from './lib/vision'
import type { AnswerSource, ExamQuestion, GradingResult, RubricPoint } from './types/exam'
import type { GradingOptions, JevSettings } from './types/jev'
import type { ScreenshotTranscript, VisionCallResult, VisionSettings } from './types/vision'

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
  const [vision, setVision] = usePersistentState<VisionSettings>('jev.vision', VISION_DEFAULTS, parseVisionSettings)
  const [subjectId, setSubjectId] = usePersistentState<string>('jev.subject', DEFAULT_SUBJECT_ID)
  const [answers, setAnswers] = usePersistentState<Record<string, string>>('jev.answers', {})
  const [maxScores, setMaxScores] = usePersistentState<Record<string, number>>('jev.maxScores', {})
  const [rubrics, setRubrics] = usePersistentState<Record<string, RubricPoint[]>>('jev.rubrics', {})
  const [results, setResults] = usePersistentState<Record<string, GradingResult>>('jev.results', EMPTY_RESULTS)
  const [transcripts, setTranscripts] = usePersistentState<Record<string, ScreenshotTranscript>>(
    'jev.transcripts',
    {},
  )
  const [errors, setErrors] = useState<Record<string, string>>(EMPTY_ERRORS)
  const [transcriptErrors, setTranscriptErrors] = useState<Record<string, string>>(EMPTY_ERRORS)
  const [running, setRunning] = useState<Record<string, boolean>>(EMPTY_RUNNING)
  const [transcribing, setTranscribing] = useState<Record<string, boolean>>(EMPTY_RUNNING)
  const [settingsOpen, setSettingsOpen] = useState(() => !isJevConfigured(JEV_DEFAULTS))
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [visionTesting, setVisionTesting] = useState(false)
  const [visionTestMessage, setVisionTestMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const controllerRef = useRef<AbortController | null>(null)
  const visionControllerRef = useRef<AbortController | null>(null)

  const configured = isJevConfigured(settings)
  const visionConfigured = isVisionConfigured(vision)
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
    async (
      question: ExamQuestion,
      overrides: { answer?: string; source?: AnswerSource } = {},
    ) => {
      setRunning((prev) => ({ ...prev, [question.id]: true }))
      setErrors((prev) => ({ ...prev, [question.id]: '' }))
      if (!controllerRef.current) controllerRef.current = new AbortController()
      const signal = controllerRef.current.signal
      const studentAnswer = overrides.answer ?? answers[question.id] ?? ''
      // 作答文字与识别结果一致（没被人工改过）时，自动带上截图来源，便于复核与导出。
      const transcript = transcripts[question.id]
      const autoSource: AnswerSource | undefined =
        transcript && studentAnswer === transcript.text
          ? {
              kind: 'screenshot',
              model: transcript.model || vision.model,
              fileNames: transcript.fileNames,
              elapsedMs: transcript.elapsedMs,
              at: transcript.at,
            }
          : undefined
      try {
        const result = await gradeQuestion({
          question,
          subject: activeSubject,
          maxScore: maxScoreOf(question),
          studentAnswer,
          answerSource: overrides.source ?? autoSource,
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
    [activeSubject, answers, maxScoreOf, options, setResults, settings, transcripts, vision.model],
  )

  /** 上传答题截图 → 识别引擎（EasyOCR 或 OpenAI 兼容视觉模型）转文字 → 填入作答 →（可选）自动交给 Jev 判分。 */
  const transcribeShots = useCallback(
    async (question: ExamQuestion, files: File[]) => {
      const easyOcr = vision.engine === 'easyocr'
      if (!visionConfigured) {
        setTranscriptErrors((prev) => ({
          ...prev,
          [question.id]: easyOcr
            ? '请先在「接口设置」里填写 EasyOCR Access Key（也可切换成识图模型）'
            : '请先在「接口设置」里填写识图模型的 Base URL / API Key / 模型名（也可切换成 EasyOCR）',
        }))
        return
      }
      setTranscribing((prev) => ({ ...prev, [question.id]: true }))
      setTranscriptErrors((prev) => ({ ...prev, [question.id]: '' }))
      if (!visionControllerRef.current) visionControllerRef.current = new AbortController()
      const signal = visionControllerRef.current.signal
      try {
        let call: VisionCallResult
        let fileNames: string[]
        if (easyOcr) {
          const images = await prepareEasyOcrImages(files)
          fileNames = images.map((image) => image.name)
          call = await transcribeWithEasyOcr({ settings: vision, images, signal })
        } else {
          const images = await prepareImageFiles(files)
          fileNames = images.map((image) => image.name ?? '截图')
          call = await transcribeAnswerImages({
            settings: vision,
            images,
            question,
            subject: activeSubject,
            signal,
          })
        }
        const transcript = buildTranscript(
          question.id,
          call,
          fileNames.map((name) => ({ name })),
        )
        setAnswers((prev) => ({ ...prev, [question.id]: call.text }))
        setTranscripts((prev) => ({ ...prev, [question.id]: transcript }))
        if (vision.autoGrade && configured) {
          await gradeOne(question, {
            answer: call.text,
            source: {
              kind: 'screenshot',
              model: transcript.model || vision.model,
              fileNames: transcript.fileNames,
              elapsedMs: transcript.elapsedMs,
              at: transcript.at,
            },
          })
        }
      } catch (error) {
        setTranscriptErrors((prev) => ({
          ...prev,
          [question.id]: easyOcr ? describeEasyOcrError(error) : describeVisionError(error),
        }))
      } finally {
        setTranscribing((prev) => ({ ...prev, [question.id]: false }))
      }
    },
    [activeSubject, configured, gradeOne, setAnswers, setTranscripts, vision, visionConfigured],
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
    visionControllerRef.current?.abort()
    visionControllerRef.current = null
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

  const testVisionConnection = useCallback(async () => {
    setVisionTesting(true)
    setVisionTestMessage(null)
    try {
      if (vision.engine === 'easyocr') {
        const call = await pingEasyOcr(vision)
        setVisionTestMessage({
          ok: true,
          text: `EasyOCR 连接成功：${call.message}，消耗 ${call.cost ?? '—'} 点${
            call.remainingQuota !== undefined ? `，剩余 ${call.remainingQuota} 点` : ''
          }，耗时 ${call.elapsedMs} ms（${call.url}）`,
        })
      } else {
        const call = await pingVision(vision)
        setVisionTestMessage({
          ok: true,
          text: `识图连接成功：模型 ${call.model ?? vision.model}，回复「${call.reply}」，耗时 ${call.elapsedMs} ms（${call.url}）`,
        })
      }
    } catch (error) {
      setVisionTestMessage({
        ok: false,
        text: vision.engine === 'easyocr' ? describeEasyOcrError(error) : describeVisionError(error),
      })
    } finally {
      setVisionTesting(false)
    }
  }, [vision])

  const exportResults = useCallback(() => {
    const payload = {
      generated_at: new Date().toISOString(),
      subject: activeSubject.label,
      subject_id: activeSubject.id,
      endpoint: `${settings.baseUrl.replace(/\/+$/, '')}/v1/systemone`,
      model: settings.model,
      vision:
        vision.engine === 'easyocr'
          ? {
              engine: vision.engine,
              endpoint: normalizeEasyOcrEndpoint(vision.easyocrEndpoint),
              model: 'easyocr',
              auto_grade: vision.autoGrade,
            }
          : {
              engine: vision.engine,
              endpoint: normalizeVisionEndpoint(vision.baseUrl),
              model: vision.model,
              auto_grade: vision.autoGrade,
            },
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
          answer_source: result?.answerSource ?? null,
          screenshot: (() => {
            const transcript = transcripts[question.id]
            if (!transcript) return null
            return {
              engine: transcript.engine ?? null,
              model: transcript.model,
              file_names: transcript.fileNames,
              at: transcript.at,
              elapsed_ms: transcript.elapsedMs,
              usage: transcript.usage ?? null,
              endpoint: transcript.endpoint ?? null,
              recognized_text: transcript.text,
            }
          })(),
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
    transcripts,
    vision,
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
    setTranscripts((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })
    setTranscriptErrors(EMPTY_ERRORS)
    setTestMessage(null)
  }, [bank, setAnswers, setResults, setTranscripts])

  const updateSettings = useCallback(
    (patch: Partial<JevSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  )
  const updateVision = useCallback(
    (patch: Partial<VisionSettings>) => setVision((prev) => ({ ...prev, ...patch })),
    [setVision],
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
              语文 · 数学 · 化学 · 生物 · 英语（作文）· 地理 · 历史 · 答题截图经 EasyOCR 或识图模型转文字，再用 TypeSafe Jev{' '}
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
          <a
            className="btn btn--ghost btn--icon"
            href="https://github.com/kingdsa/jev-chinese-grader"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub 仓库"
            title="GitHub 仓库"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </div>
      </header>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          options={options}
          vision={vision}
          testing={testing}
          testMessage={testMessage}
          visionTesting={visionTesting}
          visionTestMessage={visionTestMessage}
          onSettingsChange={updateSettings}
          onOptionsChange={updateOptions}
          onVisionChange={updateVision}
          onTest={testConnection}
          onTestVision={testVisionConnection}
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
        <li>
          在「接口设置」里填入 Jev 的 API Key；识别引擎二选一：EasyOCR（只填 Access Key）或 OpenAI 兼容视觉模型的
          Base URL / API Key / 模型名 —— 都只存在浏览器 localStorage，不会上传到任何服务器。
        </li>
        <li>切换上方科目切换题库；每题点「演示作答」按钮填入示例答案，或自己输入。</li>
        <li>
          每题「演示作答」后面有「上传答题截图」（也可以直接 Ctrl·V 粘贴）：识别引擎先转成文字填入「学生作答」，
          随后自动交给 Jev 判分；识别文字可人工修改后再重新批改，缩略图可点击看大图或删除重传。
        </li>
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
            visionConfigured={visionConfigured}
            visionAutoGrade={vision.autoGrade}
            transcribing={Boolean(transcribing[question.id])}
            transcript={transcripts[question.id]}
            transcriptError={transcriptErrors[question.id]}
            onAnalyzeShots={(files) => void transcribeShots(question, files)}
            onClearTranscript={() =>
              setTranscripts((prev) => {
                const next = { ...prev }
                delete next[question.id]
                return next
              })
            }
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