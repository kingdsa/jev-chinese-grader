export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(rounded * 10 % 1 === 0 ? 1 : 2)
}

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0%'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatConfidence(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—'
}

export function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}