import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

const control =
  'h-9 w-full rounded-control border bg-surface px-3 text-sm text-text placeholder:text-muted ' +
  'hover:border-primary/60 focus:border-primary focus:outline-none disabled:opacity-60'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** Подпись, поле и ошибка. id и aria-describedby раздаются полю через render-prop. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? hint
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className="text-caption font-semibold text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children(id, note ? noteId : undefined)}
      {note && (
        <p id={noteId} className={cn('text-xs', error ? 'text-danger' : 'text-muted')}>
          {note}
        </p>
      )}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(control, invalid ? 'border-danger' : 'border-border', className)}
      {...rest}
    />
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(control, 'pr-8', invalid ? 'border-danger' : 'border-border', className)}
      {...rest}
    >
      {children}
    </select>
  )
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: ReactNode
}

export function Checkbox({ label, description, className, ...rest }: CheckboxProps) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-sm', className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" {...rest} />
      <span>
        {label}
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  )
}
