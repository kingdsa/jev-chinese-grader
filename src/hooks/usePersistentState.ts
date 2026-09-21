import { useEffect, useState } from 'react'

/** 把状态持久化到 localStorage，刷新不丢数据。 */
export function usePersistentState<T>(
  key: string,
  initialValue: T,
  validate?: (value: unknown) => T | null,
): readonly [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return initialValue
      const parsed: unknown = JSON.parse(raw)
      return validate?.(parsed) ?? (parsed as T)
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* 隐私模式下可能写入失败，忽略 */
    }
  }, [key, value])

  return [value, setValue] as const
}