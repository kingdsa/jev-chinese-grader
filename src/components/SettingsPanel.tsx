import { HelpTip } from './HelpTip'
import { EASYOCR_DEFAULT_ENDPOINT, normalizeEasyOcrEndpoint } from '../lib/easyocr'
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
        <h3>识别引擎（答题截图 → 文字，二选一）</h3>

        <div className="segmented" role="radiogroup" aria-label="识别引擎">
          <button
            type="button"
            role="radio"
            aria-checked={vision.engine === 'easyocr'}
            className={vision.engine === 'easyocr' ? 'segmented__item segmented__item--active' : 'segmented__item'}
            onClick={() => props.onVisionChange({ engine: 'easyocr' })}
          >
            EasyOCR 在线 OCR
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={vision.engine === 'llm'}
            className={vision.engine === 'llm' ? 'segmented__item segmented__item--active' : 'segmented__item'}
            onClick={() => props.onVisionChange({ engine: 'llm' })}
          >
            OpenAI 兼容视觉模型
          </button>
        </div>

        {vision.engine === 'easyocr' ? (
          <>
            <div className="settings__grid">
              <label className="field">
                <span>EasyOCR Access Key（只保存在本地浏览器）</span>
                <input
                  type="password"
                  value={vision.easyocrAccessKey}
                  placeholder="eocr_..."
                  onChange={(event) => props.onVisionChange({ easyocrAccessKey: event.target.value })}
                />
              </label>
              <label className="field">
                <span>EasyOCR 接口地址</span>
                <input
                  value={vision.easyocrEndpoint}
                  placeholder={EASYOCR_DEFAULT_ENDPOINT}
                  onChange={(event) => props.onVisionChange({ easyocrEndpoint: event.target.value })}
                />
              </label>
              <div className="field field--action">
                <button className="btn" onClick={props.onTestVision} disabled={props.visionTesting}>
                  {props.visionTesting ? '测试中…' : '测试 EasyOCR 连接'}
                </button>
                <a className="btn btn--ghost" href="https://console.easyocr.org/" target="_blank" rel="noreferrer">
                  获取 Access Key
                </a>
              </div>
            </div>

            <p className="settings__note">
              逐张 POST 到 <code>{normalizeEasyOcrEndpoint(vision.easyocrEndpoint)}</code>
              （multipart/form-data，请求头 <code>X-Access-Key</code>），返回的 <code>words[]</code> 按坐标整理成文本。
              官方接口支持 CORS，dev / preview 与 Vercel 还内置 <code>/api/easyocr-proxy</code> 同源代理兜底。
              点数按图片最大边长计费（≤100px 1 点，601–1980px 20 点），新账号赠送 10,000 点；
              「测试连接」会上传一张带文字的小图验证 Key，消耗 1~2 点；500 / 503 会按官方建议退避重试 2 次
              并提示点数自动退还。EasyOCR 只输出文字与置信度，不做公式 LaTeX 转写——需要公式结构时改用视觉模型。
            </p>
          </>
        ) : (
          <>
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

            <p className="settings__note">
              最终请求：<code>{normalizeVisionEndpoint(vision.baseUrl) || '（未填写）'}</code>，携带{' '}
              <code>Authorization: Bearer &lt;key&gt;</code>，图片以 <code>image_url</code> data URL 放在 messages 里；
              单次超时 <b>2 分钟</b>（摆图慢的模型也够用），超时或 429 / 5xx 会自动重试 1 次。
              在 <code>npm run dev / preview</code> 下会优先走内置的 <code>/api/vision-proxy</code> 动态代理（目标地址写在
              <code>x-vision-target</code> 请求头），避免浏览器 CORS 拦截；部署时可用 Nginx 反代同样的路径。
            </p>
          </>
        )}

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
      </div>

      <div className="settings__grid settings__grid--options">
        <label className="field">
          <span>
            判分策略
            <HelpTip text="最终分数怎么算。融合＝踩中的得分点覆盖率 × 权重，再加 Jev 对整段答案的「整体印象分」× 剩余权重；只用得分点＝完全按踩中几个得分点算；只用整体档位＝完全听 Jev 的整体印象分。" />
          </span>
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
          <span>
            得分点权重占比：{Math.round(options.rubricWeight * 100)}%
            <HelpTip text="只有「融合」策略用得到：这个百分比分给「踩中得分点」，剩下的给 Jev 的整体印象分。比如 70% 就是七成看踩点、三成看整体印象。" />
          </span>
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
          <span>
            得分点命中阈值：noul ≥ {options.hitThreshold.toFixed(2)}
            <HelpTip text="Jev 会给每个得分点一个 0~1 的把握度（noul），大于等于这个值才算「答到了」。调高更严格、容易扣分；调低更宽松。" />
          </span>
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
          <span>
            最终取整
            <HelpTip text="最终得分保留到几分：1 分、0.5 分或 0.01 分（不取整）。" />
          </span>
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
        <summary>
          高级：复核提示阈值
          <HelpTip text="下面任意一条满足，结果就会标上「建议复核」——本质上都是在问：这题模型有没有把握？没把握就交给人看一眼。拿不准时保持默认即可。" />
        </summary>
        <div className="settings__grid settings__grid--options">
          <label className="field">
            <span>
              摇摆区间：|noul - 0.5| &lt; {options.reviewBand.toFixed(2)}
              <HelpTip text="某个得分点的把握度（noul）卡在 0.5 附近、模型自己也在犹豫时，就提示人工复核。这个值越大，被判「摇摆」的点越多。" />
            </span>
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
            <span>
              置信度低于 {options.reviewConfidence.toFixed(2)} 提示复核
              <HelpTip text="Jev 给整体档位分时自报的把握度（confidence）低于这个值，说明它对整段答案的评分没底，提示人工复核。" />
            </span>
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
            <span>
              两种评分差异超过 {Math.round(options.mismatchTolerance * 100)}% 提示复核
              <HelpTip text="「数得分点」和「整体印象分」两种算法给出的分数差得太多（按满分百分比衡量），说明两种判断互相打架，提示人工确认。" />
            </span>
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
            <span>
              选项判定最低置信度 {options.choiceMinConfidence.toFixed(2)}
              <HelpTip text="选择题：模型挑选选项时的把握度（confidence）低于这个值就提示复核。只在选择题生效。" />
            </span>
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