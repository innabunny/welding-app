import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { canEditTechnology } from '@/features/auth/roles'
import { InspectionModal } from '@/features/welds/InspectionModal'
import { weldStatusMeta } from '@/features/welds/labels'
import { useSetWeldStatus, useWeldPassport } from '@/features/welds/queries'
import { RunCard } from '@/features/welds/RunCard'
import { errorMessage } from '@/shared/api/errors'
import { useSession } from '@/shared/api/session'
import { formatNumber } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import type { OperationRun, WeldStatus } from '@/shared/types/welding'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { Select } from '@/shared/ui/Form'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

/** Паспорт шва: план, факт и контроль — собирается сервером из связей */
export function WeldPage() {
  const id = Number(useParams().id)
  const passport = useWeldPassport(Number.isInteger(id) ? id : null)
  const setStatus = useSetWeldStatus()
  const [inspecting, setInspecting] = useState<OperationRun | null>(null)
  // статус и заключения ведут администратор и технолог — как на бэке
  const canEdit = useSession((s) => canEditTechnology(s.user?.role))

  if (!Number.isInteger(id)) return <EmptyState title="Шов не найден" />
  if (passport.isPending) return <SkeletonRows rows={8} />
  if (passport.isError) return <ErrorState error={passport.error} onRetry={() => passport.refetch()} />

  const w = passport.data
  const status = weldStatusMeta[w.status]
  const materials =
    w.material2Marka && w.material2Marka !== w.material1Marka ? `${w.material1Marka} + ${w.material2Marka}` : w.material1Marka
  const thickness =
    w.seamThickness2 === null || w.seamThickness2 === w.seamThickness1
      ? formatNumber(w.seamThickness1, 2)
      : `${formatNumber(w.seamThickness1, 2)} / ${formatNumber(w.seamThickness2, 2)}`

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link to="/welds" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
            <ArrowLeft className="size-4" aria-hidden />
            Все швы
          </Link>
          <h1 className="mb-1 flex flex-wrap items-center gap-3 text-xl font-heading tracking-heading sm:text-2xl">
            Шов {w.seamNumber}
            <span className="font-mono text-muted">
              {w.partNumber} № {w.serialNo}
            </span>
            <Badge tone={status.tone}>{status.label}</Badge>
            {w.instanceKind === 'свидетель' && <Badge tone="blue">образец-свидетель</Badge>}
          </h1>
          <p className="text-nav text-muted">{w.partName}</p>
        </div>
        {canEdit && (
        <div className="w-full sm:w-[220px]">
          <Select
            aria-label="Статус шва"
            value={w.status}
            disabled={setStatus.isPending}
            onChange={(e) =>
              setStatus.mutate(
                { id: w.id, status: e.target.value as WeldStatus },
                {
                  onSuccess: (saved) => toast(`Шов ${w.seamNumber}: ${weldStatusMeta[saved.status].label.toLowerCase()}`),
                  onError: (error) => toast(errorMessage(error), 'error'),
                },
              )
            }
          >
            {(Object.keys(weldStatusMeta) as WeldStatus[]).map((s) => (
              <option key={s} value={s}>
                {weldStatusMeta[s].label}
              </option>
            ))}
          </Select>
        </div>
        )}
      </div>

      <div className="grid gap-5">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-heading">Шов по чертежу</h2>
          <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Материалы', materials || '—'],
              ['Толщина, мм', thickness],
              ['Соединение', w.jointType || '—'],
              ['Вид шва', w.seamType || '—'],
              ['Длина, мм', formatNumber(w.seamLength)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="text-lg font-heading">
            Выполнение операций <span className="text-muted">· {w.operations.length}</span>
          </h2>
          {w.operations.length === 0 ? (
            <EmptyState title="Операций по шву ещё не было" />
          ) : (
            w.operations.map((run) => <RunCard key={run.id} run={run} onInspect={canEdit ? () => setInspecting(run) : undefined} />)
          )}
        </Card>
      </div>

      <InspectionModal run={inspecting} onClose={() => setInspecting(null)} />
    </>
  )
}
