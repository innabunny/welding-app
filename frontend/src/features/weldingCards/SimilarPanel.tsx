import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '@/shared/api/errors'
import { formatNumber, plural } from '@/shared/lib/format'
import type { DecimalString } from '@/shared/types/common'
import { Button } from '@/shared/ui/Button'
import { DecimalInput } from '@/shared/ui/DecimalInput'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'
import { materialsText, thicknessText } from './format'
import { useSimilar } from './queries'

interface Props {
  method: string
  methodName: string
  materialId: number | null
  materialName: string
  thickness: string | null
}

function range(from: DecimalString | number | null, to: DecimalString | number | null): string {
  const a = formatNumber(from)
  const b = formatNumber(to)
  if (from === null && to === null) return '—'
  return a === b || to === null ? a : from === null ? b : `${a}–${b}`
}

/**
 * Что уже применяли на похожем соединении. Статистика — по каждому номеру
 * прохода отдельно: у корня и заполнения режимы разные, смешивать нельзя.
 * В поля ничего не подставляем — технолог переносит сам.
 */
export function SimilarPanel({ method, methodName, materialId, materialName, thickness }: Props) {
  const [tolerance, setTolerance] = useState<string | null>('2.0')
  const similar = useSimilar()
  const data = similar.data
  const run = () => similar.mutate({ method, material: materialId, thickness, tolerance: tolerance ?? undefined })

  const params = [
    methodName,
    materialName || 'любой материал',
    thickness ? `толщина ${formatNumber(thickness, 2)} ± ${formatNumber(tolerance, 1)} мм` : 'любая толщина',
  ].join(' · ')

  return (
    <section className="rounded-tile border border-border bg-surface-2/50 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden />
            Подсказка режимов
          </h3>
          <p className="mt-0.5 text-xs text-muted">{params}</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="grid gap-1 text-xs text-muted">
            Допуск по толщине, мм
            <DecimalInput
              digits={4}
              places={1}
              value={tolerance}
              onChange={setTolerance}
              className="w-24"
            />
          </label>
          <Button variant="secondary" onClick={run} disabled={!method || similar.isPending}>
            {similar.isPending ? 'Ищем…' : 'Подобрать'}
          </Button>
        </div>
      </div>

      {similar.isError && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {errorMessage(similar.error)}
        </p>
      )}

      {data && data.count === 0 && (
        <p className="mt-3 text-sm text-muted">Похожих карт нет — ни по способу, ни по процессу.</p>
      )}

      {data && data.count > 0 && (
        <div className="mt-3 grid gap-3">
          {data.level === 'процесс' ? (
            <div role="status" className="flex gap-2 rounded-control bg-warning-soft px-3 py-2.5 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                <strong>Уровень: процесс.</strong> Карт по способу «{methodName}» не хватило — цифры собраны
                с родственных способов того же процесса и смешаны. Ориентируйтесь осторожно.
              </p>
            </div>
          ) : (
            <div role="status" className="flex gap-2 rounded-control bg-success-soft px-3 py-2.5 text-sm text-success">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                <strong>Уровень: способ.</strong> Статистика только по картам этого способа.
              </p>
            </div>
          )}

          <p className="text-xs text-muted">
            Найдено {data.count} {plural(data.count, ['карта', 'карты', 'карт'])}. Значения в поля не подставляются —
            перенесите вручную.
          </p>

          <Table>
            <thead>
              <tr>
                <Th>Проход</Th>
                <Th className="text-right">Ток, А</Th>
                <Th className="text-right">Ток ср. «от», А</Th>
                <Th className="text-right">Напряжение, В</Th>
                <Th className="text-right">Скорость, м/ч</Th>
                <Th className="text-right">Подача, м/мин</Th>
                <Th className="text-right">Газ, л/мин</Th>
                <Th className="text-right">Карт</Th>
              </tr>
            </thead>
            <tbody>
              {data.passes.map((p) => (
                <Tr key={p.no}>
                  <Td className="font-semibold">№ {p.no}</Td>
                  <Td className="text-right font-mono">{range(p.currentFrom, p.currentTo)}</Td>
                  <Td className="text-right font-mono">{formatNumber(p.currentAvg)}</Td>
                  <Td className="text-right font-mono">{range(p.voltageFrom, p.voltageTo)}</Td>
                  <Td className="text-right font-mono">{range(p.speedFrom, p.speedTo)}</Td>
                  <Td className="text-right font-mono">{range(p.wireSpeedFrom, p.wireSpeedTo)}</Td>
                  <Td className="text-right font-mono">{range(p.gasFlowFrom, p.gasFlowTo)}</Td>
                  <Td className="text-right font-mono">{p.cards}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>

          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-semibold text-primary">
              Карты, по которым посчитано ({data.cards.length}
              {data.cards.length < data.count ? ` из ${data.count}` : ''})
            </summary>
            <ul className="mt-2 grid gap-1">
              {data.cards.map((c) => (
                <li key={c.id} className="flex flex-wrap gap-x-3 text-xs">
                  <a href={`/cards/${c.id}`} target="_blank" rel="noreferrer" className="font-mono font-semibold text-primary hover:underline">
                    № {c.cardNo}
                  </a>
                  <span>{c.partNumber}</span>
                  <span className="text-muted">{materialsText(c.material1Marka, c.material2Marka)}</span>
                  <span className="text-muted">{thicknessText(c.seamThickness1, c.seamThickness2)} мм</span>
                  <span className="text-muted">{c.methodName}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  )
}
