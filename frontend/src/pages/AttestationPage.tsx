import { Plus, Search, UserRound } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { canEditAttestation } from '@/features/auth/roles'
import { useWeldingMethods } from '@/features/equipment/queries'
import { STEPS, expiryMeta, statusTone } from '@/features/attestation/labels'
import { useAttestations, useWelders } from '@/features/attestation/queries'
import { WelderFormModal } from '@/features/attestation/WelderFormModal'
import { fetchWelder } from '@/shared/api/attestation'
import { errorMessage } from '@/shared/api/errors'
import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import { formatDate, plural } from '@/shared/lib/format'
import { toast } from '@/shared/lib/toast'
import type { AttestationFilters, WelderWrite } from '@/shared/types/attestation'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Checkbox, Input, Select } from '@/shared/ui/Form'
import type { Editing } from '@/shared/ui/FormModal'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'

const emptyWelder: WelderWrite = {
  fio: '',
  personnelNo: '',
  birthDate: null,
  education: '',
  workshopId: null,
  weldingSince: null,
  rank: '',
  rfidUid: null,
  isActive: true,
}

type Tab = 'attestations' | 'welders'

export function AttestationPage() {
  // вкладка в адресе: ссылкой можно поделиться, «назад» возвращает на прошлую
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'welders' ? 'welders' : 'attestations'
  const [welderEditing, setWelderEditing] = useState<Editing<WelderWrite>>(null)
  const navigate = useNavigate()
  const canEdit = useSession((s) => canEditAttestation(s.user?.role))

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">Аттестация сварщиков</h1>
          <p className="text-nav text-muted">
            {canEdit
              ? 'Допуски по способам сварки и группам материалов'
              : 'Просмотр. Вести аттестацию могут администратор, технолог и мастер'}
          </p>
        </div>
        {canEdit &&
          (tab === 'attestations' ? (
            <Button icon={<Plus />} onClick={() => navigate('/attestation/new')}>
              Новая аттестация
            </Button>
          ) : (
            <Button icon={<Plus />} onClick={() => setWelderEditing({ id: null, initial: emptyWelder })}>
              Добавить сварщика
            </Button>
          ))}
      </div>

      <div role="tablist" aria-label="Разделы аттестации" className="mb-4 flex gap-1 border-b border-border">
        {(
          [
            ['attestations', 'Аттестации'],
            ['welders', 'Сварщики'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setParams(value === 'attestations' ? {} : { tab: value })}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
              tab === value ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'attestations' ? (
        <AttestationsTab canEdit={canEdit} />
      ) : (
        <WeldersTab canEdit={canEdit} onEdit={setWelderEditing} />
      )}

      <WelderFormModal editing={welderEditing} onClose={() => setWelderEditing(null)} />
    </>
  )
}

function AttestationsTab({ canEdit }: { canEdit: boolean }) {
  const navigate = useNavigate()
  const methods = useWeldingMethods()
  const [filters, setFilters] = useState<AttestationFilters>({ search: '', status: '', method: '', expiry: '' })
  // поиск идёт на сервер — не дёргаем его на каждую букву
  const deferred = useDeferredValue(filters)
  const list = useAttestations(deferred)
  const set = (patch: Partial<AttestationFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const filtered = Object.values(filters).some(Boolean)

  let body
  if (list.isPending) body = <SkeletonRows rows={6} />
  else if (list.isError) body = <ErrorState error={list.error} onRetry={() => list.refetch()} />
  else if (list.data.length === 0)
    body = filtered ? (
      <EmptyState title="Ничего не найдено" description="Измените поиск или сбросьте фильтры." />
    ) : (
      <EmptyState
        icon={<UserRound />}
        title="Аттестаций пока нет"
        description="Начните с черновика: сварщик, способ сварки и образцы."
        action={
          canEdit && (
            <Button icon={<Plus />} onClick={() => navigate('/attestation/new')}>
              Новая аттестация
            </Button>
          )
        }
      />
    )
  else
    body = (
      <Table>
        <thead>
          <tr>
            <Th>Сварщик</Th>
            <Th>Способ</Th>
            <Th>Группа</Th>
            <Th>Этап</Th>
            <Th>Срок допуска</Th>
            <Th>Протокол / удостоверение</Th>
            <Th className="text-right">Образцов</Th>
          </tr>
        </thead>
        <tbody>
          {list.data.map((a) => (
            <Tr key={a.id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => navigate(`/attestation/${a.id}`)}>
              <Td>
                <a
                  href={`/attestation/${a.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    navigate(`/attestation/${a.id}`)
                  }}
                  className="font-semibold hover:text-primary"
                >
                  {a.welderFio}
                </a>
                <span className="block text-xs text-muted">
                  {a.kind === 'периодическая' ? 'периодическая' : 'первичная'}
                  {a.welderWorkshop ? ` · ${a.welderWorkshop}` : ''}
                </span>
              </Td>
              <Td className="max-w-[260px]">{a.methodName}</Td>
              <Td className="font-mono text-xs">{a.groupCode}</Td>
              <Td>
                <Badge tone={statusTone[a.status as keyof typeof statusTone] ?? 'gray'}>{a.statusDisplay}</Badge>
              </Td>
              <Td className="whitespace-nowrap">
                {a.expiryState ? (
                  <>
                    {/* срок — цветом и словом: цвет не считывается при дальтонизме */}
                    <Badge tone={expiryMeta[a.expiryState].tone}>{expiryMeta[a.expiryState].label}</Badge>
                    <span className="block text-xs text-muted">до {formatDate(a.validUntil)}</span>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Td>
              <Td className="font-mono text-xs">
                {a.protocolNo || '—'}
                <span className="block text-muted">{a.certificateNo || '—'}</span>
              </Td>
              <Td className="text-right font-mono">{a.itemsCount}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    )

  return (
    <Card className="p-5">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            aria-label="Поиск"
            placeholder="ФИО, № протокола или удостоверения"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        <Select aria-label="Этап" value={filters.status} onChange={(e) => set({ status: e.target.value as AttestationFilters['status'] })}>
          <option value="">Все этапы</option>
          {STEPS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Способ сварки" value={filters.method} onChange={(e) => set({ method: e.target.value })}>
          <option value="">Все способы</option>
          {methods.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.designation ? `${m.designation} — ${m.name}` : m.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Срок допуска" value={filters.expiry} onChange={(e) => set({ expiry: e.target.value as AttestationFilters['expiry'] })}>
          <option value="">Любой срок</option>
          <option value="expired">Просроченные</option>
          <option value="soon">Истекают в 60 дней</option>
          <option value="valid">Действующие</option>
        </Select>
      </div>
      {list.data && list.data.length > 0 && (
        <p className="mb-2 text-xs text-muted">
          {list.data.length} {plural(list.data.length, ['аттестация', 'аттестации', 'аттестаций'])}
        </p>
      )}
      {body}
    </Card>
  )
}

function WeldersTab({ canEdit, onEdit }: { canEdit: boolean; onEdit: (editing: Editing<WelderWrite>) => void }) {
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(true)
  const deferredSearch = useDeferredValue(search)
  const welders = useWelders({ search: deferredSearch, active })
  // карточку берём полностью только при открытии правки: в списке нет дат и UID
  const queryClient = useQueryClient()
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const openWelder = async (id: number) => {
    setLoadingId(id)
    try {
      const w = await queryClient.fetchQuery({ queryKey: ['welders', 'detail', id], queryFn: () => fetchWelder(id), staleTime: 0 })
      onEdit({
        id: w.id,
        initial: {
          fio: w.fio,
          personnelNo: w.personnelNo,
          birthDate: w.birthDate,
          education: w.education,
          workshopId: w.workshopId,
          weldingSince: w.weldingSince,
          rank: w.rank,
          rfidUid: w.rfidUid,
          isActive: w.isActive,
        },
      })
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setLoadingId(null)
    }
  }

  let body
  if (welders.isPending) body = <SkeletonRows rows={6} />
  else if (welders.isError) body = <ErrorState error={welders.error} onRetry={() => welders.refetch()} />
  else if (welders.data.length === 0)
    body = (
      <EmptyState
        icon={<UserRound />}
        title={search || !active ? 'Ничего не найдено' : 'Сварщиков пока нет'}
        description={search || !active ? 'Измените поиск.' : 'Заведите сварщика, чтобы оформить ему аттестацию.'}
        action={
          !search &&
          canEdit && (
            <Button icon={<Plus />} onClick={() => onEdit({ id: null, initial: emptyWelder })}>
              Добавить сварщика
            </Button>
          )
        }
      />
    )
  else
    body = (
      <Table>
        <thead>
          <tr>
            <Th>ФИО</Th>
            <Th>Цех</Th>
            <Th>Разряд</Th>
            <Th className="text-right">Стаж, лет</Th>
            <Th>Допуск</Th>
            <Th className="text-right">Аттестаций</Th>
          </tr>
        </thead>
        <tbody>
          {welders.data.map((w) => (
            <Tr key={w.id} className="hover:bg-surface-2/60">
              <Td>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={loadingId === w.id}
                    onClick={() => void openWelder(w.id)}
                    className="text-left font-semibold hover:text-primary"
                  >
                    {w.fio}
                  </button>
                ) : (
                  <span className="font-semibold">{w.fio}</span>
                )}
                <span className="block text-xs text-muted">
                  {w.personnelNo ? `таб. ${w.personnelNo}` : 'табельный не указан'}
                  {!w.isActive && ' · не работает'}
                </span>
              </Td>
              <Td>{w.workshopName || <span className="text-muted">—</span>}</Td>
              <Td>{w.rank || <span className="text-muted">—</span>}</Td>
              <Td className="text-right font-mono">{w.experienceYears ?? '—'}</Td>
              <Td>
                {w.isAttested ? (
                  <Badge tone={w.expiryState ? expiryMeta[w.expiryState].tone : 'green'}>
                    {w.expiryState === 'soon' ? 'Истекает' : w.expiryState === 'expired' ? 'Есть просроченные' : 'Аттестован'}
                  </Badge>
                ) : (
                  <Badge tone="gray">Нет допуска</Badge>
                )}
              </Td>
              <Td className="text-right font-mono">{w.attestationsCount}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    )

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            aria-label="Поиск по ФИО или табельному"
            placeholder="ФИО или табельный номер"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Checkbox label="Только работающие" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </div>
      {body}
    </Card>
  )
}
