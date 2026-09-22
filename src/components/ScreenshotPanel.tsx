import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDuration, formatFileSize } from '../lib/format'
import { VISION_MAX_IMAGES } from '../lib/vision'
import type { DemoScreenshot } from '../types/exam'
import type { ScreenshotTranscript } from '../types/vision'

interface ScreenshotPanelProps {
  configured: boolean
  transcribing: boolean
  autoGrade: boolean
  transcript?: ScreenshotTranscript
  error?: string
  /** 题库自带的演示学生作答截图，点一下就能载入并识别。 */
  demoScreenshot?: DemoScreenshot
  onAnalyze: (files: File[]) => void
  onClearTranscript: () => void
}

interface LocalShot {
  id: string
  file: File
  url: string
}

function isImage(file: File): boolean {
  return /^image\//i.test(file.type)
}

/**
 * 「上传答题截图」按钮：放在演示作答按钮后面，
 * 上传后原地显示缩略图（可点击看大图、可单张删除），识别结果填进作答框。
 */
export function ScreenshotPanel(props: ScreenshotPanelProps) {
  const { configured, transcribing, autoGrade, transcript, error } = props
  const [shots, setShots] = useState<LocalShot[]>([])
  const [preview, setPreview] = useState<LocalShot | null>(null)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLButtonElement>(null)
  const shotsRef = useRef(shots)
  shotsRef.current = shots

  useEffect(
    () => () => {
      for (const shot of shotsRef.current) URL.revokeObjectURL(shot.url)
    },
    [],
  )

  useEffect(() => {
    if (!preview) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [preview])

  function mergeShots(current: LocalShot[], files: File[]): LocalShot[] {
    const next = [...current]
    for (const file of files) {
      if (!isImage(file)) continue
      const duplicated = next.some(
        (shot) =>
          shot.file.name === file.name &&
          shot.file.size === file.size &&
          shot.file.lastModified === file.lastModified,
      )
      if (duplicated) continue
      if (next.length >= VISION_MAX_IMAGES) break
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        url: URL.createObjectURL(file),
      })
    }
    return next
  }

  function addFiles(files: File[], options: { autoAnalyze?: boolean } = {}) {
    const next = mergeShots(shotsRef.current, files)
    if (next.length === shotsRef.current.length) {
      if (files.length > 0 && shotsRef.current.length >= VISION_MAX_IMAGES) {
        setNotice({ text: `一次最多 ${VISION_MAX_IMAGES} 张截图，先删掉不用的再上传`, error: true })
      } else if (files.length > 0) {
        setNotice({ text: '这张截图已经在列表里了，可以点「重新识别」再跑一次', error: false })
      }
      return
    }
    setShots(next)
    setNotice(null)
    if (options.autoAnalyze !== false && !transcribing) {
      props.onAnalyze(next.map((shot) => shot.file))
    }
  }

  // 组件自己不占一块区域：粘贴监听挂在本题卡片上，在作答框里 Ctrl·V 也能直接传图。
  const addFilesRef = useRef(addFiles)
  addFilesRef.current = addFiles
  useEffect(() => {
    const card = rootRef.current?.closest('.card')
    if (!card) return
    const onPaste = (event: Event) => {
      const clipboard = (event as ClipboardEvent).clipboardData
      const files = Array.from(clipboard?.files ?? []).filter(isImage)
      if (files.length === 0) return
      event.preventDefault()
      addFilesRef.current(files)
    }
    card.addEventListener('paste', onPaste)
    return () => card.removeEventListener('paste', onPaste)
  }, [])

  /** 载入题库内置的演示截图：先拉成 File，再走和用户上传完全一样的识别流程。 */
  async function addDemoShot() {
    const demo = props.demoScreenshot
    if (!demo || loadingDemo) return
    setLoadingDemo(true)
    setNotice(null)
    try {
      const response = await fetch(demo.src)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const name = demo.src.split('/').pop() || 'demo-answer.jpg'
      addFiles([new File([blob], name, { type: blob.type || 'image/jpeg' })])
    } catch (error) {
      setNotice({
        text: `演示截图加载失败（${error instanceof Error ? error.message : String(error)}），请改用「上传答题截图」`,
        error: true,
      })
    } finally {
      setLoadingDemo(false)
    }
  }

  function removeShot(id: string) {
    const target = shots.find((shot) => shot.id === id)
    if (target) URL.revokeObjectURL(target.url)
    setShots(shots.filter((shot) => shot.id !== id))
    setNotice(null)
    if (preview?.id === id) setPreview(null)
  }

  function clearAll() {
    for (const shot of shots) URL.revokeObjectURL(shot.url)
    setShots([])
    setPreview(null)
    setNotice(null)
    if (transcript) props.onClearTranscript()
  }

  const hasLocalShots = shots.length > 0
  const recognizedText = transcript?.text ?? ''
  const recognized = Boolean(transcript)
  const showPanel = hasLocalShots || recognized || Boolean(error)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          addFiles(files)
        }}
      />
      <button
        ref={rootRef}
        className="chip chip--shot"
        disabled={transcribing}
        title="上传后由识图模型转成文字填入作答框；也可以直接 Ctrl·V 粘贴截图（图片只用于本次识别，不写进 localStorage）"
        onClick={() => inputRef.current?.click()}
      >
        {transcribing ? '识别截图中…' : hasLocalShots ? '继续上传截图' : '上传答题截图'}
      </button>

      {props.demoScreenshot && !hasLocalShots && (
        <button
          className="chip chip--demo"
          disabled={transcribing || loadingDemo}
          title="载入本题内置的学生作答截图示例，再点「重新识别」或下次上传时可以替换成自己的截图"
          onClick={() => void addDemoShot()}
        >
          {loadingDemo ? '载入演示截图…' : props.demoScreenshot.label}
        </button>
      )}

      {showPanel && (
        <div className="shots">
          {hasLocalShots && (
            <ul className="shots__thumbs">
              {shots.map((shot) => (
                <li key={shot.id}>
                  <button
                    className="shots__thumb"
                    title="点击预览大图"
                    aria-label={`预览截图 ${shot.file.name}`}
                    onClick={() => setPreview(shot)}
                  >
                    <img src={shot.url} alt={shot.file.name} />
                  </button>
                  <button className="btn btn--tiny btn--ghost" onClick={() => removeShot(shot.id)}>
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="shots__actions">
            <button
              className="btn btn--tiny"
              disabled={!configured || transcribing || !hasLocalShots}
              onClick={() => props.onAnalyze(shots.map((shot) => shot.file))}
            >
              {transcribing ? '识别中…' : '重新识别'}
            </button>
            <button className="btn btn--tiny btn--ghost" onClick={clearAll}>
              清除截图与识别结果
            </button>
            {!configured && (
              <span className="hint hint--error">请先在「接口设置」里填写识图模型的 Base URL / API Key / 模型名</span>
            )}
            {notice && (
              <span className={notice.error ? 'hint hint--error' : 'hint'}>{notice.text}</span>
            )}
          </div>

          {recognized &&
            (recognizedText ? (
              <p className="hint hint--ok">
                已识别（{transcript?.model || '识图模型'} · {formatDuration(transcript?.elapsedMs ?? 0)}）
                → 文字已填入上方作答{autoGrade ? '并自动提交 Jev 判分' : '，确认无误后再点「批改本题」'}
              </p>
            ) : (
              <p className="hint">
                截图中没有识别到可辨认的作答（模型返回 NO_ANSWER），已按空白作答处理；如果有误可手动输入。
              </p>
            ))}

          {recognized && recognizedText && (
            <details className="shots__raw">
              <summary>查看识别原文（{recognizedText.length} 字，可用于核对人工修改）</summary>
              <pre>{recognizedText}</pre>
            </details>
          )}

          {error && <p className="hint hint--error">{error}</p>}
        </div>
      )}

      {preview &&
        createPortal(
          <div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="答题截图预览"
            onClick={() => setPreview(null)}
          >
            <figure className="lightbox__body" onClick={(event) => event.stopPropagation()}>
              <img src={preview.url} alt={preview.file.name} />
              <figcaption className="lightbox__meta">
                <span>
                  {preview.file.name} · {formatFileSize(preview.file.size)}
                </span>
                <span className="lightbox__hint">点击空白处或按 Esc 关闭</span>
              </figcaption>
            </figure>
          </div>,
          document.body,
        )}
    </>
  )
}