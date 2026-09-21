import { formatScore } from '../lib/format'

export function ScoreRing({ score, maxScore }: { score: number; maxScore: number }) {
  const ratio = maxScore > 0 ? Math.min(Math.max(score / maxScore, 0), 1) : 0
  const percent = Math.round(ratio * 100)
  return (
    <div
      className="ring"
      style={{ background: `conic-gradient(var(--ring-color) ${percent}%, var(--ring-track) ${percent}% 100%)` }}
      role="img"
      aria-label={`得分 ${formatScore(score)} / ${formatScore(maxScore)}`}
    >
      <div className="ring__inner">
        <strong>{formatScore(score)}</strong>
        <span>/ {formatScore(maxScore)}</span>
      </div>
    </div>
  )
}