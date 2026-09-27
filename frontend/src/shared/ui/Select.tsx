import { Check, ChevronDown, Search } from 'lucide-react'
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/shared/lib/cn'

interface Option {
  value: string
  label: string
  disabled: boolean
}

/** Такое же событие, как у нативного select: вызовы onChange={(e) => e.target.value} не меняются */
export interface SelectChangeEvent {
  target: { value: string }
}

export interface SelectProps {
  /** undefined — то же, что пустое значение */
  value: string | number | undefined
  onChange?: (e: SelectChangeEvent) => void
  /** <option value="…" disabled>подпись</option> — как у нативного select */
  children: ReactNode
  id?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
}

/** Поиск в списке появляется, когда вариантов больше этого */
const SEARCH_FROM = 9

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

/** <option> из детей, в том числе из массивов и фрагментов */
function collectOptions(children: ReactNode, out: Option[] = []): Option[] {
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) return
    if (child.type === 'option') {
      const { value, disabled, children: label } = child.props
      const text = textOf(label)
      out.push({ value: String(value ?? text), label: text, disabled: Boolean(disabled) })
    } else {
      collectOptions(child.props.children, out)
    }
  })
  return out
}

/**
 * Свой селект вместо браузерного. Список открывается через Popover API:
 * он попадает в top layer и рисуется поверх модалок на <dialog>, а не
 * обрезается прокруткой тела модалки или таблицы.
 */
export function Select({
  value,
  onChange,
  children,
  id,
  disabled,
  invalid,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: SelectProps) {
  const autoId = useId()
  const triggerId = id ?? autoId
  const listId = `${autoId}-list`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [place, setPlace] = useState<{ left: number; top: number; width: number; up: boolean; maxHeight: number }>()
  const typeahead = useRef({ text: '', at: 0 })

  const current = value === undefined ? '' : String(value)
  const options = collectOptions(children)
  const selected = options.find((o) => o.value === current)
  const searchable = options.length > SEARCH_FROM
  const needle = query.trim().toLowerCase()
  const visible = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options

  const openList = () => {
    if (disabled) return
    setQuery('')
    const index = options.findIndex((o) => o.value === current)
    setActive(index >= 0 ? index : options.findIndex((o) => !o.disabled))
    setOpen(true)
  }

  const closeList = (refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  const choose = (option: Option | undefined) => {
    if (!option || option.disabled) return
    if (option.value !== current) onChange?.({ target: { value: option.value } })
    closeList()
  }

  // позиция: под полем, а если снизу мало места — над ним
  const measure = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const gap = 6
    const below = window.innerHeight - rect.bottom - gap - 8
    const above = rect.top - gap - 8
    const up = below < 220 && above > below
    setPlace({
      left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 180) - 8),
      top: up ? rect.top - gap : rect.bottom + gap,
      width: rect.width,
      up,
      maxHeight: Math.min(320, Math.max(up ? above : below, 120)),
    })
  }

  useLayoutEffect(() => {
    const pop = popRef.current
    if (!open || !pop) return
    measure()
    // без Popover API (старые браузеры) список просто остаётся fixed поверх страницы
    if (typeof pop.showPopover === 'function') pop.showPopover()
    if (searchable) searchRef.current?.focus()
    return () => {
      if (typeof pop.hidePopover === 'function' && pop.matches(':popover-open')) pop.hidePopover()
    }
    // measure читает только DOM — пересчитываем при открытии
  }, [open, searchable])

  // прокрутка страницы или модалки — список едет вместе с полем
  useEffect(() => {
    if (!open) return
    const onMove = () => measure()
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!popRef.current?.contains(target) && !triggerRef.current?.contains(target)) closeList(false)
    }
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open])

  // активный вариант всегда в видимой части списка
  useEffect(() => {
    if (!open || active < 0) return
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId])

  const move = (step: 1 | -1, from = active) => {
    if (visible.length === 0) return
    let i = from
    for (let n = 0; n < visible.length; n++) {
      i = (i + step + visible.length) % visible.length
      if (!visible[i]?.disabled) return setActive(i)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        move(1, -1)
        break
      case 'End':
        e.preventDefault()
        move(-1, visible.length)
        break
      case 'Enter':
        e.preventDefault()
        choose(visible[active])
        break
      case ' ':
        // пробел в поиске — это пробел, а не выбор
        if (e.currentTarget === searchRef.current) return
        e.preventDefault()
        choose(visible[active])
        break
      case 'Escape':
        // закрываем список, а не модалку вокруг
        e.preventDefault()
        e.stopPropagation()
        closeList()
        break
      case 'Tab':
        closeList(false)
        break
      default:
        // набор букв без поиска — прыжок к варианту, как у нативного
        if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          const now = Date.now()
          const t = typeahead.current
          t.text = now - t.at < 700 ? t.text + e.key.toLowerCase() : e.key.toLowerCase()
          t.at = now
          const i = visible.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.text))
          if (i >= 0) setActive(i)
        }
    }
  }

  const placeholder = selected?.value === ''

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !searchable && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-9 w-full min-w-0 items-center gap-2 rounded-control border bg-surface pl-3 pr-2 text-left text-sm text-text',
          'hover:border-primary/60 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
          open && 'border-primary',
          invalid ? 'border-danger' : !open && 'border-border',
          className,
        )}
      >
        {/* w-0 + flex-1: текст не распирает кнопку — иначе длинное значение
            задаёт минимальную ширину и селект залезает на соседнюю колонку */}
        <span className={cn('w-0 flex-1 truncate', (placeholder || !selected) && 'text-muted')}>
          {selected?.label || ' '}
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          ref={popRef}
          popover="manual"
          style={
            place && {
              left: place.left,
              top: place.top,
              minWidth: Math.max(place.width, 180),
              maxWidth: Math.max(place.width, 420),
              transform: place.up ? 'translateY(-100%)' : undefined,
            }
          }
          // inset-auto: у [popover] в стилях браузера inset: 0, он спорил бы с left/top
          className="fixed inset-auto z-50 m-0 flex flex-col overflow-hidden rounded-control border border-border bg-surface p-0 text-text shadow-card"
        >
          {searchable && (
            <div className="relative shrink-0 border-b border-border p-1.5">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
              <input
                ref={searchRef}
                role="combobox"
                aria-label="Поиск по списку"
                aria-controls={listId}
                aria-expanded
                aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                autoComplete="off"
                value={query}
                placeholder="Поиск"
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                onKeyDown={onKeyDown}
                className="h-8 w-full rounded-tag bg-surface-2 pl-8 pr-2 text-sm placeholder:text-muted focus:outline-none"
              />
            </div>
          )}
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={ariaLabel ? undefined : triggerId}
            aria-label={ariaLabel}
            style={{ maxHeight: place?.maxHeight }}
            className="overflow-y-auto overscroll-contain p-1"
          >
            {visible.length === 0 && <li className="px-3 py-2.5 text-center text-xs text-muted">Ничего не найдено</li>}
            {visible.map((o, i) => {
              const isSelected = o.value === current
              return (
                <li
                  key={`${o.value}-${i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  // mousedown, а не click: фокус не уходит с поля и список не мигает
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(o)
                  }}
                  onMouseMove={() => !o.disabled && active !== i && setActive(i)}
                  className={cn(
                    'flex min-h-8 items-center gap-2 rounded-tag px-2.5 py-1.5 text-sm',
                    o.disabled ? 'cursor-not-allowed text-muted opacity-60' : 'cursor-pointer',
                    i === active && !o.disabled && 'bg-surface-2',
                    isSelected && 'font-semibold text-primary',
                    o.value === '' && !isSelected && 'text-muted',
                  )}
                >
                  <span className="min-w-0 flex-1">{o.label}</span>
                  {isSelected && <Check className="size-4 shrink-0" aria-hidden />}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
