import { useId, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { DecimalInput } from '@/shared/ui/DecimalInput'
import type { DecimalFormat } from './fields'
import { rangeError } from './format'

interface BoxProps {
  label: string
  unit?: string
  required?: boolean
  error?: string
  /** Серый поясняющий текст — отдельной строкой под сообщением, не вместо него */
  note?: ReactNode
  className?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/**
 * Подпись, поле и строка сообщения. Строка под ошибку всегда занимает
 * место, поэтому появившаяся ошибка не двигает соседей по сетке.
 */
export function FieldBox({ label, unit, required, error, note, className, children }: BoxProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className="text-caption font-semibold text-muted">
        {label}
        {unit && <span className="font-normal">, {unit}</span>}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children(id, error ? errorId : undefined)}
      <p id={errorId} role={error ? 'alert' : undefined} className="min-h-[17px] text-xs leading-[17px] text-danger">
        {error}
      </p>
      {note && <div className="-mt-1 text-xs text-muted">{note}</div>}
    </div>
  )
}

interface RangeProps {
  label: string
  unit?: string
  format: DecimalFormat
  min: string | null
  max: string | null
  onChange: (min: string | null, max: string | null) => void
  /** Ошибка с сервера по любому из двух полей */
  serverError?: string
  disabled?: boolean
  className?: string
}

/** Пара «от–до» с общим сообщением и проверкой, что «от» не больше «до» */
export function RangeField({ label, unit, format, min, max, onChange, serverError, disabled, className }: RangeProps) {
  const error = rangeError(min, max) ?? serverError
  return (
    <FieldBox label={label} unit={unit} error={error} className={className}>
      {(id, describedBy) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
          <DecimalInput
            id={id}
            aria-label={`${label}: от`}
            aria-describedby={describedBy}
            placeholder="от"
            invalid={Boolean(error)}
            disabled={disabled}
            {...format}
            value={min}
            onChange={(v) => onChange(v, max)}
          />
          <span aria-hidden className="text-muted">
            –
          </span>
          <DecimalInput
            aria-label={`${label}: до`}
            aria-describedby={describedBy}
            placeholder="до"
            invalid={Boolean(error)}
            disabled={disabled}
            {...format}
            value={max}
            onChange={(v) => onChange(min, v)}
          />
        </div>
      )}
    </FieldBox>
  )
}


/** Значение только для чтения: поля шва и то, что считает сервер */
export function ReadOnlyValue({ label, unit, value, className }: {
  label: string
  unit?: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid content-start gap-1', className)}>
      <span className="text-caption font-semibold text-muted">
        {label}
        {unit && <span className="font-normal">, {unit}</span>}
      </span>
      <span className="text-sm">{value ?? <span className="text-muted">не задано</span>}</span>
    </div>
  )
}
