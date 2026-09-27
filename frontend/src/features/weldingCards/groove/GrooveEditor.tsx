import { cn } from '@/shared/lib/cn'
import { DecimalInput } from '@/shared/ui/DecimalInput'
import { FieldBox } from '../FormBits'
import { GROOVE_TYPES, grooveParams, grooveSvg, isGrooveType, type GrooveDraft, type GrooveType } from './grooveSvg'

type Sizes = Omit<GrooveDraft, 'grooveType'>

/**
 * Типовые размеры под толщину шва. Одни на все случаи не годятся:
 * c = 1,5 мм из прежнего редактора рассчитаны на 11,5 мм — на шве 2 мм
 * от скоса почти ничего не остаётся, и эскиз выглядит как две пластины.
 */
function sizesFor(type: GrooveType, s: number): Sizes {
  const thin = s <= 3
  if (type === 'I')
    return {
      grooveAngle: null,
      grooveGap: s <= 2 ? '0.5' : '1.0',
      grooveRoot: null,
      grooveCap: '1.0',
      grooveRootCap: '0.5',
      grooveWidth: '1.0',
    }
  return {
    grooveAngle: '60.0',
    grooveGap: thin ? '1.0' : s <= 8 ? '1.5' : '2.0',
    grooveRoot: thin ? '0.5' : s <= 6 ? '1.0' : '1.5',
    grooveCap: '1.0',
    grooveRootCap: thin ? '0.5' : '1.0',
    grooveWidth: thin ? '1.0' : '1.5',
  }
}

/** Скос короче 40% толщины — на эскизе его почти не видно */
function bevelTooSmall(draft: GrooveDraft, s: number): boolean {
  if (draft.grooveType !== 'V') return false
  const c = Number(draft.grooveRoot ?? 0)
  return s - c < s * 0.4
}

interface Props {
  draft: GrooveDraft
  update: (patch: Partial<GrooveDraft>) => void
  /** Толщины позиций из шва, мм */
  s1: number | null
  s2: number | null
  /** Проходов в карте — эскиз рисует их слоями */
  passes: number
  errors: Record<string, string>
}

const FIELDS: {
  key: keyof Omit<GrooveDraft, 'grooveType'>
  label: string
  unit: string
  note?: string
  only?: GrooveType[]
}[] = [
  { key: 'grooveAngle', label: 'Угол разделки α', unit: '°', only: ['V'] },
  { key: 'grooveGap', label: 'Зазор b', unit: 'мм' },
  { key: 'grooveRoot', label: 'Притупление c', unit: 'мм', only: ['V'] },
  { key: 'grooveCap', label: 'Усиление g', unit: 'мм' },
  { key: 'grooveRootCap', label: 'Корень g₁', unit: 'мм' },
  // как в прежнем генераторе: f — заход на кромку, полная ширина e считается сама
  { key: 'grooveWidth', label: 'Ширина шва f', unit: 'мм', note: 'заход валика на кромку с каждой стороны' },
]

/**
 * Эскиз разделки строится из размеров — технологу не нужно рисовать
 * и прикладывать чертёж. Картинка сохраняется в карте и печатается в бланке.
 */
export function GrooveEditor({ draft, update, s1, s2, passes, errors }: Props) {
  const type = isGrooveType(draft.grooveType) ? draft.grooveType : null
  const params = grooveParams(draft, s1, s2, passes)
  const svg = params ? grooveSvg(params) : null

  // толщина, по которой рисуется эскиз: большая из двух позиций шва
  const s = Math.max(s1 ?? 0, s2 ?? 0) || 3
  const sRu = s.toLocaleString('ru-RU')

  const choose = (next: GrooveType | null) => {
    if (next === null) return update({ grooveType: '' })
    // типовые размеры — только в пустые поля, введённое не затираем
    const defaults = sizesFor(next, s)
    const patch: Partial<GrooveDraft> = { grooveType: next }
    for (const [key, value] of Object.entries(defaults) as [keyof Sizes, string | null][])
      if (draft[key] === null) patch[key] = value
    update(patch)
  }

  const resetSizes = () => type && update(sizesFor(type, s))

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Тип разделки" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[{ value: null, label: 'Без эскиза', hint: 'разделка не указывается' }, ...GROOVE_TYPES].map((t) => {
          const selected = type === t.value
          return (
            <button
              key={t.value ?? 'none'}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(t.value)}
              className={cn(
                'rounded-tile border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                selected ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:border-primary/50 hover:bg-surface-2',
              )}
            >
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className={cn('block text-xs', selected ? 'text-primary/80' : 'text-muted')}>{t.hint}</span>
            </button>
          )
        })}
      </div>

      {type && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="grid content-start gap-x-4 sm:grid-cols-2">
            {FIELDS.filter((f) => !f.only || f.only.includes(type)).map((f) => (
              <FieldBox key={f.key} label={f.label} unit={f.unit} error={errors[f.key]} note={f.note}>
                {(id, describedBy) => (
                  <DecimalInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={Boolean(errors[f.key])}
                    digits={5}
                    places={1}
                    value={draft[f.key]}
                    onChange={(v) => update({ [f.key]: v })}
                  />
                )}
              </FieldBox>
            ))}
            <button type="button" onClick={resetSizes} className="justify-self-start text-xs font-semibold text-primary hover:underline sm:col-span-2">
              Типовые размеры для толщины {sRu} мм
            </button>
            <p className="text-xs text-muted sm:col-span-2">
              {s1 === null && s2 === null
                ? 'Толщина у шва не задана — эскиз нарисован для 3 мм. Задайте её в «Детали и операции».'
                : `Толщина s = ${sRu} мм — из шва, проходов ${passes} — из карты.`}
            </p>
          </div>
          <figure className="grid content-start gap-1.5">
            {bevelTooSmall(draft, s) && (
              <div role="status" className="grid gap-2 rounded-control bg-warning-soft px-3 py-2.5 text-sm text-warning">
                <p>
                  Скоса почти нет: притупление c = {Number(draft.grooveRoot).toLocaleString('ru-RU')} мм при толщине {sRu} мм.
                  {s <= 3 && ' Металл до 3 мм обычно варят без разделки.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={resetSizes} className="rounded-control border border-warning/50 px-2.5 py-1 text-xs font-semibold hover:bg-warning/10">
                    Подобрать размеры по толщине {sRu} мм
                  </button>
                  {s <= 3 && (
                    <button type="button" onClick={() => update({ grooveType: 'I' })} className="rounded-control border border-warning/50 px-2.5 py-1 text-xs font-semibold hover:bg-warning/10">
                      Без разделки
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* через img, а не вставкой разметки — как и в бланке */}
            {svg && (
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                alt="Эскиз разделки кромок"
                className="w-full rounded-tile border border-border bg-white p-2"
              />
            )}
            <figcaption className="text-xs text-muted">Эскиз сохранится вместе с картой и попадёт в бланк.</figcaption>
          </figure>
        </div>
      )}
    </div>
  )
}
