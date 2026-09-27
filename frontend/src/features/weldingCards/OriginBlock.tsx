import { fieldsFor, type MethodCode } from '@/shared/config/methodFields'
import { formatNumber } from '@/shared/lib/format'
import type { Operation, SeamSpec } from '@/shared/types/technology'
import type { WeldingCard } from '@/shared/types/weldingCards'
import { Select } from '@/shared/ui/Form'
import { seamValue } from './fields'
import { FieldBox, ReadOnlyValue } from './FormBits'
import { useOperations, useParts } from './queries'

interface Props {
  /** Сохранённая карта; для новой — undefined */
  card: WeldingCard | undefined
  method: MethodCode | null
  operation: Operation | undefined
  seam: SeamSpec | undefined
  /** Только для новой карты: выбор детали и операции */
  partId: number | null
  operationId: number | null
  onPick: (partId: number | null, operationId: number | null) => void
  operationError?: string
}

const DECIMAL_SEAM_KEYS = new Set(['thickness_1', 'thickness_2', 'mass_1', 'mass_2', 'seam_diameter', 'seam_length'])

/**
 * Откуда карта: деталь, операция, шов и его свойства. Всё только для
 * чтения — шов правится в «Детали и операции», карта его лишь показывает.
 */
export function OriginBlock({ card, method, operation, seam, partId, operationId, onPick, operationError }: Props) {
  // какие поля шва нужны этому способу; пока способ не выбран — все
  const seamFields = (method ? fieldsFor(method, 'card') : fieldsFor('tig1', 'card')).filter((f) => f.owner === 'seam')
  const hasSeam = Boolean(card || seam)

  return (
    <section className="rounded-tile border border-border bg-surface-2/50 p-4">
      <h2 className="mb-3 text-sm font-semibold">Откуда карта</h2>

      {card ? (
        <div className="mb-3 grid gap-4 sm:grid-cols-3">
          <ReadOnlyValue
            label="Деталь"
            value={
              <>
                <span className="font-mono font-semibold">{card.partNumber}</span> {card.partName}
              </>
            }
          />
          <ReadOnlyValue
            label="Операция"
            value={
              <>
                <span className="font-mono">{card.operationNumber}</span>
                {operation?.name && <span className="text-muted"> · {operation.name}</span>}
              </>
            }
          />
          <ReadOnlyValue label="Шов" value={<span className="font-mono">{card.seamNumber}</span>} />
        </div>
      ) : (
        <PickOperation partId={partId} operationId={operationId} onPick={onPick} error={operationError} />
      )}

      {hasSeam ? (
        <div className="grid gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {seamFields.map((f) => {
            const value = seamValue(f, card ?? {}, seam)
            return (
              <ReadOnlyValue
                key={f.key}
                label={f.label}
                unit={f.unit}
                value={value && DECIMAL_SEAM_KEYS.has(f.key) ? <span className="font-mono">{formatNumber(value, 3)}</span> : value}
              />
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted">Выберите операцию — материалы, толщины и геометрия подтянутся из её шва.</p>
      )}
      <p className="mt-3 text-xs text-muted">Свойства шва правятся в разделе «Детали и операции».</p>
    </section>
  )
}

function PickOperation({ partId, operationId, onPick, error }: {
  partId: number | null
  operationId: number | null
  onPick: (partId: number | null, operationId: number | null) => void
  error?: string
}) {
  const parts = useParts()
  const operations = useOperations(partId)

  return (
    <div className="mb-1 grid gap-x-4 sm:grid-cols-2">
      <FieldBox label="Деталь" required>
        {(id) => (
          <Select
            id={id}
            value={partId ?? ''}
            disabled={parts.isPending}
            onChange={(e) => onPick(e.target.value === '' ? null : Number(e.target.value), null)}
          >
            <option value="">{parts.isPending ? 'Загрузка…' : parts.data?.length === 0 ? 'Деталей нет' : 'Не выбрана'}</option>
            {parts.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name}
              </option>
            ))}
          </Select>
        )}
      </FieldBox>
      <FieldBox label="Операция" required error={error}>
        {(id, describedBy) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            invalid={Boolean(error)}
            value={operationId ?? ''}
            disabled={partId === null || operations.isPending}
            onChange={(e) => onPick(partId, e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">
              {partId === null ? 'Сначала деталь' : operations.data?.length === 0 ? 'У детали нет операций' : 'Не выбрана'}
            </option>
            {operations.data?.map((o) => (
              // на операцию — одна карта: занятые видны, но не выбираются
              <option key={o.id} value={o.id} disabled={o.hasCard}>
                оп. {o.number}
                {o.name ? ` · ${o.name}` : ''} · шов {o.seamNumber}
                {o.hasCard ? ' — карта уже есть' : ''}
              </option>
            ))}
          </Select>
        )}
      </FieldBox>
    </div>
  )
}
