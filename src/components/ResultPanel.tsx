import { formatConfidence, formatDuration, formatPercent, formatScore } from '../lib/format'
import type { GradingResult } from '../types/exam'
import { ScoreRing } from './ScoreRing'

function DistributionBars({
  legend,
  probabilities,
  highlight,
}: {
  legend: Record<string, string>
  probabilities: Record<string, number>
  highlight?: number
}) {
  const hasLegend = Object.keys(legend).length > 0
  const keys = hasLegend ? Object.keys(legend) : Object.keys(probabilities)
  const entries = keys
    .map((key) => ({
      key,
      label: legend[key] ?? `选项 ${key}`,
      value: probabilities[key] ?? 0,
      numeric: Number(key),
    }))
    .sort((a, b) => (Number.isNaN(a.numeric) ? 0 : a.numeric) - (Number.isNaN(b.numeric) ? 0 : b.numeric))

  return (
    <ul className="dist">
      {entries.map((entry) => (
        <li key={entry.key} className={highlight === entry.numeric ? 'dist__item dist__item--on' : 'dist__item'}>
          <span className="dist__label">
            {hasLegend ? (
              <>
                <b>{entry.key}</b> {entry.label}
              </>
            ) : (
              entry.label
            )}
          </span>
          <span className="dist__bar">
            <i style={{ width: `${Math.round(entry.value * 100)}%` }} />
          </span>
          <span className="dist__value">{formatPercent(entry.value)}</span>
        </li>
      ))}
    </ul>
  )
}

export function ResultPanel({ result }: { result: GradingResult }) {
  const quality = result.quality
  const choice = result.choice

  return (
    <div className="result">
      <div className="result__head">
        <ScoreRing score={result.score} maxScore={result.maxScore} />
        <div className="result__meta">
          <div className="result__badges">
            {result.blank && <span className="badge badge--muted">空白作答（本地判 0）</span>}
            {result.answerSource && (
              <span className="badge badge--muted" title={result.answerSource.fileNames.join('、')}>
                作答来自截图识别（{result.answerSource.model || '识图模型'}）
              </span>
            )}
            {result.needsReview ? (
              <span className="badge badge--warn">建议人工复核</span>
            ) : (
              <span className="badge badge--ok">判定稳定</span>
            )}
            <span className="badge badge--muted">置信度 {formatConfidence(result.confidence)}</span>
            <span className="badge badge--muted">{formatDuration(result.elapsedMs)}</span>
            {result.model && <span className="badge badge--muted">{result.model}</span>}
            {result.usage && (
              <span className="badge badge--muted">
                tokens {result.usage.input_tokens ?? '?'} / {result.usage.output_tokens ?? '?'}
              </span>
            )}
          </div>
          <dl className="result__numbers">
            <div>
              <dt>得分点覆盖率</dt>
              <dd>{result.rubricScore === null ? '—' : `${formatScore(result.rubricScore)} 分`}</dd>
            </div>
            <div>
              <dt>Jev 整体档位分</dt>
              <dd>{result.directScore === null ? '—' : `${formatScore(result.directScore)} 分`}</dd>
            </div>
            <div>
              <dt>融合后（未取整）</dt>
              <dd>{formatScore(result.blendedRaw)} 分</dd>
            </div>
          </dl>
        </div>
      </div>

      {result.rubric.length > 0 && (
        <section className="result__block">
          <h4>得分点判定（Noul 原语）</h4>
          <ul className="rubric-list">
            {result.rubric.map((item) => (
              <li key={item.point.id} className={item.hit ? 'rubric-list__item is-hit' : 'rubric-list__item'}>
                <span className="rubric-list__mark">{item.hit ? '✓' : '✗'}</span>
                <span className="rubric-list__label">
                  {item.point.label}
                  <span className="rubric-list__weight">权重 {item.point.weight}</span>
                </span>
                <span className="rubric-list__noul">
                  <i style={{ width: `${Math.round(item.noul * 100)}%` }} />
                </span>
                <span className="rubric-list__value">
                  {item.noul.toFixed(2)}
                  {item.uncertain && <em> 摇摆</em>}
                </span>
                <span className="rubric-list__earned">+{formatScore(item.earned)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {quality && (
        <section className="result__block">
          <h4>
            整体档位分（Score 原语）：档位位置 {quality.raw.toFixed(2)} → 归一化 {formatPercent(quality.ratio)} ×
            满分 = {formatScore(result.directScore ?? 0)} 分，置信度 {formatConfidence(quality.confidence)}
          </h4>
          <DistributionBars
            legend={quality.legend}
            probabilities={quality.probabilities}
            highlight={Math.round(quality.raw)}
          />
        </section>
      )}

      {choice && (
        <section className="result__block">
          <h4>选项判定（Choice 原语）</h4>
          <p className="result__choice">
            学生被判定选择 <b>{choice.picked}</b>，正确答案 <b>{choice.correct}</b> ——{' '}
            <span className={choice.matched ? 'text-ok' : 'text-bad'}>
              {choice.matched ? '一致，得满分' : '不一致，不得分'}
            </span>
            （置信度 {formatConfidence(choice.confidence)}）
          </p>
          <DistributionBars legend={{}} probabilities={choice.probabilities} />
        </section>
      )}

      {result.notes.length > 0 && (
        <section className="result__block">
          <h4>判分说明</h4>
          <ul className="notes">
            {result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      {result.reviewReasons.length > 0 && (
        <section className="result__block">
          <h4>复核提示</h4>
          <ul className="notes notes--warn">
            {result.reviewReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      )}

      <details className="result__raw">
        <summary>查看原始请求 / 响应（Jev systemone）</summary>
        <div className="result__raw-grid">
          <div>
            <h5>state</h5>
            <pre>{JSON.stringify(result.requestState, null, 2)}</pre>
          </div>
          <div>
            <h5>questions</h5>
            <pre>{JSON.stringify(result.requestQuestions, null, 2)}</pre>
          </div>
          <div>
            <h5>answers</h5>
            <pre>{JSON.stringify(result.rawAnswers, null, 2)}</pre>
          </div>
        </div>
      </details>
    </div>
  )
}