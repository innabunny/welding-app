import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  value: string
  invalid?: boolean
  /** Показать счётчик «120 / 500» под полем */
  counter?: boolean
}

/**
 * Многострочное поле, растущее по содержимому. Растёт до max-h, дальше
 * прокручивается само — иначе длинный текст раздвинет модалку.
 */
export function AutoTextarea({ value, invalid, counter, maxLength, className, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])

  const near = maxLength !== undefined && value.length >= maxLength * 0.9

  return (
    <div className="grid gap-1">
      <textarea
        ref={ref}
        rows={3}
        value={value}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        className={cn(
          'max-h-[240px] min-h-[84px] w-full resize-none rounded-control border bg-surface px-3 py-2 text-sm text-text',
          'placeholder:text-muted hover:border-primary/60 focus:border-primary focus:outline-none',
          invalid ? 'border-danger' : 'border-border',
          className,
        )}
        {...rest}
      />
      {counter && maxLength !== undefined && (
        <span aria-hidden className={cn('justify-self-end font-mono text-xs', near ? 'text-warning' : 'text-muted')}>
          {value.length} / {maxLength}
        </span>
      )}
    </div>
  )
}
