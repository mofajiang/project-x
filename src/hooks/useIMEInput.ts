import { useState, useRef, useCallback } from 'react'

/**
 * 处理中文/日文等 IME 输入法组合输入问题
 * 在组合输入期间（拼音未上屏前）不触发 onChange，避免输入卡住
 */
export function useIMEInput(
  value: string,
  onChange: (val: string) => void
) {
  const composing = useRef(false)
  const [localValue, setLocalValue] = useState(value)

  // 外部 value 变化时同步（仅非组合状态）
  const syncedValue = composing.current ? localValue : value

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocalValue(e.target.value)
    if (!composing.current) {
      onChange(e.target.value)
    }
  }, [onChange])

  const handleCompositionStart = useCallback(() => {
    composing.current = true
    setLocalValue(value)
  }, [value])

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    composing.current = false
    const val = (e.target as HTMLInputElement).value
    setLocalValue(val)
    onChange(val)
  }, [onChange])

  return {
    value: syncedValue,
    onChange: handleChange,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
  }
}
