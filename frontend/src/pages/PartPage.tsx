import { ArrowLeft, FilePlus2, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { canEditTechnology } from '@/features/auth/roles'
import { emptySeam } from '@/features/parts/defaults'
import { OperationFormModal } from '@/features/parts/OperationFormModal'
import { PartFormModal } from '@/features/parts/PartFormModal'
import { useDeleteOperation, useDeletePart, useDeleteSeam, usePart } from '@/features/parts/queries'
import { SeamFormModal } from '@/features/parts/SeamFormModal'
import { errorMessage } from '@/shared/api/errors'
import { useSession } from '@/shared/api/session'
import { formatNumber } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import type { Operation, OperationWrite, PartDetail, PartWrite, SeamSpec, SeamWrite } from '@/shared/types/technology'
import { Badge } from '@/shared/ui/Badge'
import { Button, IconButton } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import type { Editing } from '@/shared/ui/FormModal'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'

function thickness(s: SeamSpec): string {
  const a = formatNumber(s.thickness1, 2)
  if (s.thickness2 === null || s.thickness2 === s.thickness1) return a
  return `${a} / ${formatNumber(s.thickness2, 2)}`
}

function materials(s: SeamSpec): string {
  if (s.material2Marka && s.material2Marka !== s.material1Marka) return `${s.material1Marka || '—'} + ${s.material2Marka}`
  return s.material1Marka || '—'
}

/** Опасное действие — серое, красное только под курсором */
const DANGER_ICON = 'text-muted hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-40'

const toPartWrite = (p: PartDetail): PartWrite => ({
  number: p.number,
  name: p.name,
  note: p.note,
  isActive: p.isActive,
})

const toSeamWrite = (s: SeamSpec): SeamWrite => ({
  partId: s.partId,
  number: s.number,
  jointType: s.jointType,
  material1Id: s.material1Id,
  material2Id: s.material2Id,
  thickness1: s.thickness1,
  thickness2: s.thickness2,
  pos1: s.pos1,
  pos2: s.pos2,
  mass1: s.mass1,
  mass2: s.mass2,
  seamType: s.seamType,
  seamDiameter: s.seamDiameter,
  seamLength: s.seamLength,
})

const toOperationWrite = (o: Operation): OperationWrite => ({
  partId: o.partId,
  seamId: o.seamId,
  number: o.number,
  name: o.name,
  order: o.order,
  requiredControls: [...o.requiredControls],
})

export function PartPage() {
  const navigate = useNavigate()
  const id = Number(useParams().id)
  const part = usePart(Number.isInteger(id) ? id : null)
  const canEdit = useSession((s) => canEditTechnology(s.user?.role))

  const [editingPart, setEditingPart] = useState<Editing<PartWrite>>(null)
  const [editingSeam, setEditingSeam] = useState<Editing<SeamWrite>>(null)
  const [editingOperation, setEditingOperation] = useState<Editing<OperationWrite>>(null)
  const removePart = useDeletePart()
  const removeSeam = useDeleteSeam()
  const removeOperation = useDeleteOperation()

  /** Подтверждение, удаление; причину отказа сервер объясняет сам */
  const confirmDelete = (
    question: string,
    mutation: typeof removePart,
    targetId: number,
    done: string,
    after?: () => void,
  ) => {
    if (!window.confirm(question)) return
    mutation.mutate(targetId, {
      onSuccess: () => {
        toast(done)
        after?.()
      },
      onError: (error) => toast(errorMessage(error), 'error'),
    })
  }

  if (!Number.isInteger(id)) return <EmptyState title="Деталь не найдена" />
  if (part.isPending) return <SkeletonRows rows={8} />
  if (part.isError) return <ErrorState error={part.error} onRetry={() => part.refetch()} />

  const p = part.data
  // операции — в порядке техпроцесса, а не по номеру
  const operations = [...p.operations].sort((a, b) => a.order - b.order || a.number.localeCompare(b.number, 'ru', { numeric: true }))
  const seams = [...p.seams].sort((a, b) => a.number.localeCompare(b.number, 'ru', { numeric: true }))
  const nextOrder = operations.reduce((max, o) => Math.max(max, o.order), 0) + 10

  const addOperation = () =>
    setEditingOperation({
      id: null,
      initial: {
        partId: p.id,
        // один шов — сразу подставляем его
        seamId: seams.length === 1 ? (seams[0]?.id ?? null) : null,
        number: '',
        name: '',
        order: nextOrder,
        requiredControls: [],
      },
    })

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link to="/parts" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
            <ArrowLeft className="size-4" aria-hidden />
            Все детали
          </Link>
          <h1 className="mb-1 flex flex-wrap items-center gap-3 text-xl font-heading tracking-heading sm:text-2xl">
            <span className="font-mono">{p.number}</span>
            <span>{p.name}</span>
            <Badge tone={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'В производстве' : 'Снята'}</Badge>
          </h1>
          {p.note && <p className="whitespace-pre-line text-nav text-muted">{p.note}</p>}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              icon={<Trash2 />}
              disabled={removePart.isPending}
              className="hover:bg-danger-soft hover:text-danger"
              onClick={() =>
                confirmDelete(
                  `Удалить деталь ${p.number} вместе со швами и операциями?`,
                  removePart,
                  p.id,
                  `Деталь ${p.number} удалена`,
                  () => navigate('/parts'),
                )
              }
            >
              Удалить
            </Button>
            <Button variant="secondary" icon={<Pencil />} onClick={() => setEditingPart({ id: p.id, initial: toPartWrite(p) })}>
              Изменить деталь
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-5">
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-heading">Операции</h2>
              <p className="text-xs text-muted">Техпроцесс по порядку. На каждую операцию — одна техкарта.</p>
            </div>
            {canEdit && (
              <Button
                variant="secondary"
                icon={<Plus />}
                onClick={addOperation}
                disabled={seams.length === 0}
                title={seams.length === 0 ? 'Сначала заведите шов: операция варит конкретный шов' : undefined}
              >
                Добавить операцию
              </Button>
            )}
          </div>
          {operations.length === 0 ? (
            <EmptyState
              title="Операций пока нет"
              description={
                seams.length === 0
                  ? 'Сначала заведите шов ниже — операция всегда варит конкретный шов.'
                  : 'Добавьте операции техпроцесса: для каждой потом составляется техкарта.'
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>№ оп.</Th>
                  <Th>Наименование</Th>
                  <Th>Шов</Th>
                  <Th>Контроль после</Th>
                  <Th>Техкарта</Th>
                  {canEdit && (
                    <Th className="w-24">
                      <span className="sr-only">Действия</span>
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {operations.map((o) => (
                  <Tr key={o.id} className="hover:bg-surface-2/60">
                    <Td className="font-mono font-semibold">{o.number}</Td>
                    <Td>{o.name || <span className="text-muted">—</span>}</Td>
                    <Td className="font-mono">{o.seamNumber}</Td>
                    <Td>
                      {o.requiredControls.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {o.requiredControls.map((c) => (
                            <Badge key={c} tone="blue">
                              {c}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted">не назначен</span>
                      )}
                    </Td>
                    <Td>
                      {o.cardId !== null ? (
                        <Link
                          to={`/cards/${o.cardId}`}
                          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                        >
                          <FileText className="size-4" aria-hidden />
                          № {o.cardNo}
                          <Badge tone={o.cardIsReleased ? 'green' : 'yellow'} className="ml-1">
                            {o.cardIsReleased ? 'Выпущена' : 'Черновик'}
                          </Badge>
                        </Link>
                      ) : (
                        <Button
                          variant="link"
                          onClick={() => navigate(`/cards/new?operation=${o.id}&part=${p.id}`)}
                          className="inline-flex items-center gap-1.5"
                        >
                          <FilePlus2 className="size-4" aria-hidden />
                          Составить карту
                        </Button>
                      )}
                    </Td>
                    {canEdit && (
                      <Td>
                        <span className="flex gap-1.5">
                          <IconButton
                            label={`Изменить операцию ${o.number}`}
                            onClick={() => setEditingOperation({ id: o.id, initial: toOperationWrite(o) })}
                          >
                            <Pencil />
                          </IconButton>
                          <IconButton
                            label={`Удалить операцию ${o.number}`}
                            className={DANGER_ICON}
                            disabled={removeOperation.isPending}
                            onClick={() =>
                              confirmDelete(`Удалить операцию ${o.number}?`, removeOperation, o.id, `Операция ${o.number} удалена`)
                            }
                          >
                            <Trash2 />
                          </IconButton>
                        </span>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-heading">Швы по чертежу</h2>
              <p className="text-xs text-muted">Материалы, толщины и геометрия — отсюда их берут техкарты.</p>
            </div>
            {canEdit && (
              <Button
                variant="secondary"
                icon={<Plus />}
                onClick={() => setEditingSeam({ id: null, initial: emptySeam(p.id) })}
              >
                Добавить шов
              </Button>
            )}
          </div>
          {seams.length === 0 ? (
            <EmptyState title="Швов пока нет" description="Шов описывает стык: из чего, какой толщины, прямой или кольцевой." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>№ шва</Th>
                  <Th>Соединение</Th>
                  <Th>Материалы</Th>
                  <Th className="text-right">Толщина, мм</Th>
                  <Th>Вид</Th>
                  <Th className="text-right">Длина, мм</Th>
                  <Th className="text-right">Операций</Th>
                  {canEdit && (
                    <Th className="w-24">
                      <span className="sr-only">Действия</span>
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {seams.map((s) => (
                  <Tr key={s.id} className="hover:bg-surface-2/60">
                    <Td className="font-mono font-semibold">{s.number}</Td>
                    <Td>{s.jointType || <span className="text-muted">—</span>}</Td>
                    <Td>{materials(s)}</Td>
                    <Td className="text-right font-mono">{thickness(s)}</Td>
                    <Td>
                      {s.seamType === 'кольцевой' ? (
                        s.seamDiameter ? (
                          <>кольцевой, Ø {formatNumber(s.seamDiameter, 2)}</>
                        ) : (
                          // без диаметра техкарта не пересчитает об/мин в м/ч
                          <Badge tone="yellow">кольцевой, нет Ø</Badge>
                        )
                      ) : (
                        s.seamType || <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td className="text-right font-mono">{formatNumber(s.seamLength)}</Td>
                    <Td className="text-right font-mono">{s.operationsCount}</Td>
                    {canEdit && (
                      <Td>
                        <span className="flex gap-1.5">
                          <IconButton label={`Изменить шов ${s.number}`} onClick={() => setEditingSeam({ id: s.id, initial: toSeamWrite(s) })}>
                            <Pencil />
                          </IconButton>
                          <IconButton
                            label={`Удалить шов ${s.number}`}
                            className={DANGER_ICON}
                            disabled={removeSeam.isPending}
                            onClick={() => confirmDelete(`Удалить шов ${s.number}?`, removeSeam, s.id, `Шов ${s.number} удалён`)}
                          >
                            <Trash2 />
                          </IconButton>
                        </span>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <PartFormModal editing={editingPart} onClose={() => setEditingPart(null)} />
      <SeamFormModal editing={editingSeam} onClose={() => setEditingSeam(null)} />
      <OperationFormModal editing={editingOperation} seams={seams} onClose={() => setEditingOperation(null)} />
    </>
  )
}
