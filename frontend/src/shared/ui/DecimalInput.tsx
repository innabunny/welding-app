import { useState, type InputHTMLAttributes } from 'react'
import { displayDecimal, fitsDecimal, normalizeDecimal, roundDecimal, type DecimalLimits } from '@/shared/lib/decimal'
import { Input } from './Form'

interface Props
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>,
    DecimalLimits {
  /** Строка с точкой, как у DecimalField, или null */
  value: string | null
  onChange: (value: string | null) => void
  invalid?: boolean
}

/**
 * Число под разрядность DecimalField. Буквы и лишние знаки не вводятся,
 * запятая превращается в точку, при потере фокуса — округление.
 */
export function DecimalInput({ value, onChange, digits, places, negative, onFocus, onBlur, ...rest }: Props) {
  // пока поле в фокусе, показываем набранное как есть: «12,» не превратится в «12»
  const [editing, setEditing] = useState<string | null>(null)
  const limits = { digits, places, negative }

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={editing ?? displayDecimal(value)}
      onFocus={(e) => {
        setEditing(displayDecimal(value))
        onFocus?.(e)
      }}
      onChange={(e) => {
        const text = e.target.value
        const normalized = normalizeDecimal(text)
        if (!fitsDecimal(normalized, limits)) return
        setEditing(text)
        onChange(normalized === '' ? null : normalized)
      }}
      onBlur={(e) => {
        const rounded = roundDecimal(editing, places)
        setEditing(null)
        if (rounded !== value) onChange(rounded)
        onBlur?.(e)
      }}
      className={`font-mono ${rest.className ?? ''}`}
    />
  )
}
