import { isDirectTypesafeUrl, JEV_DEFAULTS } from '../lib/jev'
import { normalizeVisionEndpoint, VISION_DEFAULTS } from '../lib/vision'
import type { GradingOptions, JevSettings, RoundingMode } from '../types/jev'
import type { VisionSettings } from '../types/vision'

interface SettingsPanelProps {
  settings: JevSettings
  options: GradingOptions
  vision: VisionSettings
  testing: boolean
  testMessage: { ok: boolean; text: string } | null
  visionTesting: boolean
  visionTestMessage: { ok: boolean; text: string } | null
  onSettingsChange: (patch: Partial<JevSettings>) => void
  onOptionsChange: (patch: Partial<GradingOptions>) => void
  onVisionChange: (patch: Partial<VisionSettings>) => void
  onTest: () => void
  onTestVision: () => void
  onClose: () => void
}

const STRATEGY_LABELS: Record<GradingOptions['strategy'], string> = {
  blend: '融合：得分点覆盖率 + Jev 整体档位分',
  rubric: '只用得分点覆盖率',
  direct: '只用 Jev 整体档位分',
}

const ROUNDING_LABELS: Record<RoundingMode, string> = {
  half: '0.5 分',
  int: '1 分',
  none: '不取整（0.01）',
}

export function SettingsPanel(props: SettingsPanelProps) {
  const { settings, options, vision } = props

  return (
    <section className="settings">
      <div className="settings__grid">
        <label className="field">
          <span>Jev Base URL</span>
          <input
            value={settings.baseUrl}
            placeholder="https://api.typesafe.ai"
            onChange={(event) => props.onSettingsChange({ baseUrl: event.target.value })}
          />
        </label>
        <label className="field">
          <span>模型</span>
          <input
            value={settings.model}
            placeholder="jev-latest"
            onChange={(event) => props.onSettingsChange({ model: event.target.value })}
          />
        </label>
        <label className="field">
          <span>API Key（只保存在本地浏览器）</span>
          <input
            type="password"
            value={settings.apiKey}
            placeholder="到 console.typesafe.ai/keys 获取"
            onChange={(event) => props.onSettingsChange({ apiKey: event.target.value })}
          />
        </label>
        <div className="field field--action">
          <button className="btn" onClick={props.onTest} disabled={props.testing}>
            {props.testing ? '测试中…' : '测试连接'}
          </button>
          <button className="btn btn--ghost" onClick={props.onClose}>
            收起设置
          </button>
        </div>
      </div>

      {props.testMessage && (
        <p className={props.testMessage.ok ? 'hint hint--ok' : 'hint hint--error'}>{props.testMessage.text}</p>
      )}

      {isDirectTypesafeUrl(settings.baseUrl) && (
        <p className="hint hint--error">
          浏览器直连 <code>api.typesafe.ai</code> 会被 CORS 拦截（报 <code>TypeError: Failed to fetch</code>，
          Network 面板里通常只看到 <code>Referrer Policy: strict-origin-when-cross-origin</code>）。
          <button
            className="btn btn--tiny"
            style={{ marginLeft: 8 }}
            onClick={() => props.onSettingsChange({ baseUrl: JEV_DEFAULTS.baseUrl })}
          >
            改用内置代理 /api/typesafe
          </button>
        </p>
      )}

      <div className="settings__section">
        <h3>识图模型（答题截图 → 文字，OpenAI 兼容）</h3>
        <div className="settings__grid">
          <label className="field">
            <span>识图 Base URL</span>
            <input
              value={vision.baseUrl}
              placeholder="https://api.openai.com/v1"
              onChange={(event) => props.onVisionChange({ baseUrl: event.target.value })}
            />
          </label>
          <label className="field">
            <span>识图模型</span>
            <input
              value={vision.model}
              placeholder="gpt-4o-mini"
              onChange={(event) => props.onVisionChange({ model: event.target.value })}
            />
          </label>
          <label className="field">
            <span>识图 API Key（只保存在本地浏览器）</span>
            <input
              type="password"
              value={vision.apiKey}
              placeholder="sk-..."
              onChange={(event) => props.onVisionChange({ apiKey: event.target.value })}
            />
          </label>
          <div className="field field--action">
            <button className="btn" onClick={props.onTestVision} disabled={props.visionTesting}>
              {props.visionTesting ? '测试中…' : '测试识图连接'}
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => props.onVisionChange({ baseUrl: VISION_DEFAULTS.baseUrl, model: VISION_DEFAULTS.model })}
            >
              恢复 OpenAI 默认
            </button>
          </div>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={vision.autoGrade}
            onChange={(event) => props.onVisionChange({ autoGrade: event.target.checked })}
          />
          识别完成后自动提交 Jev 批改本题（取消勾选则只填文字，确认后再手动批改）
        </label>

        {props.visionTestMessage && (
          <p className={props.visionTestMessage.ok ? 'hint hint--ok' : 'hint hint--error'}>
            {props.visionTestMessage.text}
          </p>
        )}

        <p className="settings__note">
          最终请求：<code>{normalizeVisionEndpoint(vision.baseUrl) || '（未填写）'}</code>，携带{' '}
          <code>Authorization: Bearer &lt;key&gt;</code>，图片以 <code>image_url</code> data URL 放在 messages 里；
          单次超时 <b>2 分钟</b>（摆图慢的模型也够用），超时或 429 / 5xx 会自动重试 1 次。
          在 <code>npm run dev / preview</code> 下会优先走内置的 <code>/api/vision-proxy</code> 动态代理（目标地址写在
          <code>x-vision-target</code> 请求头），避免浏览器 CORS 拦截；部署时可用 Nginx 反代同样的路径。
        </p>
      </div>

      <div className="settings__grid settings__grid--options">
        <label className="field">
          <span>判分策略</span>
          <select
            value={options.strategy}
            onChange={(event) =>
              props.onOptionsChange({ strategy: event.target.value as GradingOptions['strategy'] })
            }
          >
            {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>得分点权重占比：{Math.round(options.rubricWeight * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={options.rubricWeight}
            disabled={options.strategy !== 'blend'}
            onChange={(event) => props.onOptionsChange({ rubricWeight: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>得分点命中阈值：noul ≥ {options.hitThreshold.toFixed(2)}</span>
          <input
            type="range"
            min={0.3}
            max={0.9}
            step={0.05}
            value={options.hitThreshold}
            onChange={(event) => props.onOptionsChange({ hitThreshold: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>最终取整</span>
          <select
            value={options.rounding}
            onChange={(event) => props.onOptionsChange({ rounding: event.target.value as RoundingMode })}
          >
            {Object.entries(ROUNDING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="settings__advanced">
        <summary>高级：复核提示阈值</summary>
        <div className="settings__grid settings__grid--options">
          <label className="field">
            <span>摇摆区间：|noul - 0.5| &lt; {options.reviewBand.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={0.3}
              step={0.02}
              value={options.reviewBand}
              onChange={(event) => props.onOptionsChange({ reviewBand: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>置信度低于 {options.reviewConfidence.toFixed(2)} 提示复核</span>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={options.reviewConfidence}
              onChange={(event) => props.onOptionsChange({ reviewConfidence: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>两种评分差异超过 {Math.round(options.mismatchTolerance * 100)}% 提示复核</span>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.05}
              value={options.mismatchTolerance}
              onChange={(event) => props.onOptionsChange({ mismatchTolerance: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>选项判定最低置信度 {options.choiceMinConfidence.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={0.95}
              step={0.05}
              value={options.choiceMinConfidence}
              onChange={(event) => props.onOptionsChange({ choiceMinConfidence: Number(event.target.value) })}
            />
          </label>
        </div>
      </details>

      <p className="settings__note">
        默认 Base URL <code>/api/typesafe</code> 是相对路径，由 <code>vite dev / preview</code> 内置的代理转发到{' '}
        <code>https://api.typesafe.ai</code>，请求同源、不触发 CORS（部署时用自己的 Nginx 反代同样的路径）。
        最终请求：<code>{settings.baseUrl.replace(/\/+$/, '')}/v1/systemone</code>，携带{' '}
        <code>Authorization: Bearer &lt;key&gt;</code>。
      </p>
    </section>
  )
}