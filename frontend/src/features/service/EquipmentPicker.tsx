import { Check, ChevronDown, Zap } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '@/shared/lib/cn'
import type { Equipment } from '@/shared/types/equipment'

interface Props {
  id?: string
  items: Equipment[]
  loading: boolean
  value: number | null
  onChange: (id: number) => void
  invalid?: boolean
  describedBy?: string
}

/** «Tetrix 300 · РИН · пост 14» — строка для поиска */
function haystack(e: Equipment): string {
  return [e.name, e.methodDesignation, e.methodName, e.workstationNumber && `пост ${e.workstationNumber}`, e.workshopName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function subtitle(e: Equipment): string {
  const place = e.workstationNumber ? `пост ${e.workstationNumber}` : 'пост не задан'
  return [e.methodDesignation || e.methodName, place].join(' · ')
}

/**
 * Селект с поиском по названию, способу и посту. Список раскрывается
 * в потоке под полем, а не поверх: в модалке с прокруткой выпадашка
 * поверх обрезалась бы краем тела.
 */
export function EquipmentPicker({ id, items, loading, value, onChange, invalid, describedBy }: Props) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = items.find((e) => e.id === value)
  const needle = query.trim().toLowerCase()
  // рабочие установки — первыми
  const options = items
    .filter((e) => !needle || haystack(e).includes(needle))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive))

  const pick = (e: Equipment) => {
    onChange(e.id)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (options.length === 0 ? 0 : (i + step + options.length) % options.length))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      const option = options[active]
      if (option) pick(option)
    } else if (e.key === 'Escape' && open) {
      // закрываем список, а не модалку
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div>
      <div className="relative">
        <Zap className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${options[active].id}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={loading ? 'Загрузка…' : 'Найдите установку по названию, способу или посту'}
          disabled={loading}
          value={open ? query : (selected?.name ?? '')}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onBlur={() => {
            setOpen(false)
            setQuery('')
          }}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            'h-10 w-full rounded-control border bg-surface pl-9 pr-9 text-sm text-text placeholder:text-muted',
            'hover:border-primary/60 focus:border-primary focus:outline-none disabled:opacity-60',
            invalid ? 'border-danger' : 'border-border',
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'Свернуть список' : 'Показать все установки'}
          onClick={() => {
            setOpen((o) => !o)
            inputRef.current?.focus()
          }}
          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-tag text-muted hover:text-text"
        >
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {!open && selected && <p className="mt-1 pl-1 text-xs text-muted">{subtitle(selected)}</p>}

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Установки"
          className="mt-1.5 max-h-[232px] overflow-y-auto rounded-control border border-border bg-surface p-1 shadow-card"
        >
          {options.length === 0 && (
            <li className="px-3 py-3 text-center text-xs text-muted">
              {items.length === 0 ? 'Установок в реестре нет' : 'Ничего не найдено'}
            </li>
          )}
          {options.map((e, i) => {
            const isSelected = e.id === value
            return (
              <li
                key={e.id}
                id={`${listId}-${e.id}`}
                role="option"
                aria-selected={isSelected}
                // mousedown, а не click: иначе поле потеряет фокус и список закроется раньше
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  pick(e)
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-tag px-2.5 py-2',
                  i === active && 'bg-surface-2',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm', isSelected && 'font-semibold text-primary')}>
                    {e.name}
                    {!e.isActive && <span className="font-normal text-muted"> · не в работе</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{subtitle(e)}</span>
                </span>
                {isSelected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
