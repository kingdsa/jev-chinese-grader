import { formatScore } from '../lib/format'
import type { ExamQuestion, GradingResult, RubricPoint } from '../types/exam'
import { ResultPanel } from './ResultPanel'

interface QuestionCardProps {
  question: ExamQuestion
  maxScore: number
  rubric: RubricPoint[]
  answer: string
  result?: GradingResult
  stale?: boolean
  error?: string
  running: boolean
  configured: boolean
  onMaxScoreChange: (value: number) => void
  onRubricChange: (rubric: RubricPoint[]) => void
  onAnswerChange: (value: string) => void
  onGrade: () => void
  onClear: () => void
}

export function QuestionCard(props: QuestionCardProps) {
  const { question, maxScore, rubric, answer, result, stale, error, running, configured } = props
  const answerLength = answer.replace(/\s|\u3000/g, '').length

  function updatePoint(index: number, patch: Partial<RubricPoint>) {
    const next = rubric.map((point, i) => (i === index ? { ...point, ...patch } : point))
    props.onRubricChange(next)
  }

  return (
    <article className={result ? 'card card--graded' : 'card'}>
      <header className="card__head">
        <div className="card__no">{question.no}</div>
        <div className="card__titles">
          <span className="tag">{question.kindLabel}</span>
          <label className="maxscore">
            满分
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={maxScore}
              onChange={(event) => props.onMaxScoreChange(Number(event.target.value))}
            />
            分
          </label>
        </div>
        {result && (
          <div className="card__score">
            <strong>{formatScore(result.score)}</strong>
            <span>/ {formatScore(maxScore)}</span>
          </div>
        )}
      </header>

      {stale && <p className="hint hint--error">满分已调整，当前结果仍是旧的满分，建议重新批改。</p>}

      <p className="card__stem">
        {question.stem.split('\n').map((line, index) => (
          <span key={`${question.id}-stem-${index}`}>
            {line}
            {index < question.stem.split('\n').length - 1 && <br />}
          </span>
        ))}
      </p>

      {question.material && (
        <blockquote className="card__material">
          {question.material.split('\n').map((line, index) => (
            <span key={`${question.id}-material-${index}`}>
              {line}
              <br />
            </span>
          ))}
        </blockquote>
      )}

      <details className="card__details">
        <summary>标准答案与评分要点</summary>
        <div className="standard">
          <h4>标准答案</h4>
          <p>{question.standardAnswer}</p>
          {question.gradingNotes && <p className="muted">评分说明：{question.gradingNotes}</p>}
        </div>

        <div className="rubric-editor">
          <h4>评分要点（权重可改，最终按权重占比折算到满分）</h4>
          {rubric.length === 0 && (
            <p className="muted">本题为选择题，直接由 Jev 的 Choice 原语判定选项，不设得分点。</p>
          )}
          {rubric.map((point, index) => (
            <div className="rubric-editor__row" key={point.id}>
              <input
                value={point.label}
                onChange={(event) => updatePoint(index, { label: event.target.value })}
              />
              <input
                className="rubric-editor__weight"
                type="number"
                min={0.5}
                step={0.5}
                value={point.weight}
                onChange={(event) => updatePoint(index, { weight: Number(event.target.value) })}
              />
              <button
                className="btn btn--tiny btn--ghost"
                onClick={() => props.onRubricChange(rubric.filter((_, i) => i !== index))}
              >
                删除
              </button>
            </div>
          ))}
          <button
            className="btn btn--tiny"
            onClick={() =>
              props.onRubricChange([
                ...rubric,
                { id: `${question.id}-custom-${Date.now()}`, label: '新的得分点', weight: 1 },
              ])
            }
          >
            + 添加得分点
          </button>
        </div>
      </details>

      <div className="answer">
        <div className="answer__head">
          <h4>学生作答</h4>
          <span className="muted">{answerLength} 字</span>
        </div>
        <textarea
          value={answer}
          rows={question.defaultMaxScore >= 8 ? 8 : 4}
          placeholder="输入学生答案，或点下方演示按钮快速填入……"
          onChange={(event) => props.onAnswerChange(event.target.value)}
        />
        <div className="answer__demos">
          <span className="muted">演示作答：</span>
          {question.demoAnswers.map((demo) => (
            <button
              key={demo.label}
              className="chip"
              onClick={() => props.onAnswerChange(demo.content)}
              title={demo.content || '（空答案）'}
            >
              {demo.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card__actions">
        <button className="btn btn--primary" onClick={props.onGrade} disabled={running || !configured}>
          {running ? '批改中…' : result ? '重新批改' : '批改本题'}
        </button>
        {result && (
          <button className="btn btn--ghost" onClick={props.onClear}>
            清除结果
          </button>
        )}
        {!configured && <span className="hint hint--error">请先在「接口设置」里填写 API Key</span>}
        {error && <span className="hint hint--error">{error}</span>}
      </div>

      {result && <ResultPanel result={result} />}
    </article>
  )
}