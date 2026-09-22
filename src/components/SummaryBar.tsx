import { formatScore } from '../lib/format'

interface SummaryBarProps {
  subjectLabel?: string
  totalScore: number
  totalMax: number
  gradedCount: number
  questionCount: number
  reviewCount: number
  running: boolean
  configured: boolean
  onGradeAll: () => void
  onCancel: () => void
  onExport: () => void
  onReset: () => void
}

export function SummaryBar(props: SummaryBarProps) {
  const percent = props.totalMax > 0 ? Math.round((props.totalScore / props.totalMax) * 100) : 0

  return (
    <div className="summary">
      <div className="summary__total">
        <span className="summary__label">
          {props.subjectLabel ? `${props.subjectLabel}总分` : '总分'}（满分 {formatScore(props.totalMax)}）
        </span>
        <span className="summary__value">
          {formatScore(props.totalScore)}
          <em>得分率 {percent}%</em>
        </span>
      </div>

      <div className="summary__progress">
        <span className="summary__label">
          已批改 {props.gradedCount} / {props.questionCount}
        </span>
        <span className="summary__bar">
          <i
            style={{
              width: `${props.questionCount ? Math.round((props.gradedCount / props.questionCount) * 100) : 0}%`,
            }}
          />
        </span>
        {props.reviewCount > 0 && <span className="badge badge--warn">{props.reviewCount} 题建议复核</span>}
      </div>

      <div className="summary__actions">
        {props.running ? (
          <button className="btn btn--ghost" onClick={props.onCancel}>
            停止批改
          </button>
        ) : (
          <button className="btn btn--primary" onClick={props.onGradeAll} disabled={!props.configured}>
            一键批改全部
          </button>
        )}
        <button className="btn" onClick={props.onExport} disabled={props.gradedCount === 0}>
          导出结果 JSON
        </button>
        <button className="btn btn--ghost" onClick={props.onReset} title="只清空当前科目的作答与结果">
          重置
        </button>
      </div>
    </div>
  )
}