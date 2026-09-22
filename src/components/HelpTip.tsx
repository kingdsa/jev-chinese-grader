interface HelpTipProps {
  text: string
}

export function HelpTip({ text }: HelpTipProps) {
  return (
    <button
      type="button"
      className="help-tip"
      aria-label={`名词解释：${text}`}
      data-tip={text}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      ?
    </button>
  )
}