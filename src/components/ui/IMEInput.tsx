'use client'
import { useIMEInput } from '@/hooks/useIMEInput'

interface IMEInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onValueChange: (val: string) => void
}

/**
 * 支持 IME 输入法（双拼/全拼/五笔等）的 Input 组件
 * 在组合输入完成后才触发 onValueChange，避免中文输入卡顿
 */
export function IMEInput({ value, onValueChange, ...props }: IMEInputProps) {
  const imeProps = useIMEInput(value, onValueChange)
  return <input {...props} {...imeProps} />
}

interface IMETextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string
  onValueChange: (val: string) => void
}

export function IMETextarea({ value, onValueChange, ...props }: IMETextareaProps) {
  const imeProps = useIMEInput(value, onValueChange)
  return <textarea {...props} {...imeProps} />
}
