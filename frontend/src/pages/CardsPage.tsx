import { ChevronDown, ChevronUp, FileText, Plus, Search, X } from 'lucide-react'
import { useDeferredValue, useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useEquipmentList, useWeldingMethods } from '@/features/equipment/queries'
import { useMaterials } from '@/features/materials/queries'
import { CardTable } from '@/features/weldingCards/CardTable'
import { useParts, useWeldingCards } from '@/features/weldingCards/queries'
import { processLabels } from '@/shared/config/processes'
import { plural } from '@/shared/lib/format'
import type { WeldingCardFilters } from '@/shared/types/weldingCards'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { DecimalInput } from '@/shared/ui/DecimalInput'
import { Input, Select } from '@/shared/ui/Form'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

const emptyFilters: WeldingCardFilters = {
  search: '',
  part: '',
  method: '',
  process: '',
  equipment: '',
  material: '',
  thicknessFrom: '',
  thicknessTo: '',
  released: '',
}

// Парсим запрос на фронте ТОЛЬКО для отображения чипов (чтобы не ломать API)
function parseSearchQuery(query: string | undefined, materialsData: any[] | undefined) {
  const parsed: { material?: string; thickness?: string } = {}
  if (!query) return parsed

  // 1. Толщина
  const thicknessMatch = query.match(/(\d+(?:[.,]\d+)?)\s*(?:мм|mm)?/i)
  if (thicknessMatch && thicknessMatch[1]) {
    parsed.thickness = thicknessMatch[1].replace(',', '.') + ' мм'
  }

  // 2. Материал (ищем в уже загруженном справочнике)
  if (materialsData) {
    const lowerQuery = query.toLowerCase()
    const found = materialsData.find(
      (m) =>
        lowerQuery.includes(m.marka.toLowerCase()) ||
        m.marka.toLowerCase().split(' ').some((w: string) => w.length > 3 && lowerQuery.includes(w))
    )
    if (found) {
      parsed.material = found.marka
    }
  }

  return parsed
}

export function CardsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<WeldingCardFilters>(emptyFilters)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const deferred = useDeferredValue(filters)
  const list = useWeldingCards(deferred)

  const parts = useParts()
  const methods = useWeldingMethods()
  const equipment = useEquipmentList({})
  const materials = useMaterials()

  const set = (patch: Partial<WeldingCardFilters>) => setFilters((prev) => ({ ...prev, ...patch }))
  const filtered = Object.values(filters).some((v) => v)
  const newCard = () => navigate('/cards/new')

  // Вычисляем чипы для отображения
  const parsedChips = useMemo(
    () => parseSearchQuery(filters.search, materials.data),
    [filters.search, materials.data]
  )
  const hasChips = parsedChips.material || parsedChips.thickness

  let body
  if (list.isPending) body = <SkeletonRows rows={6} />
  else if (list.isError) body = <ErrorState error={list.error} onRetry={() => list.refetch()} />
  else if (list.data.length === 0)
    body = filtered ? (
      <EmptyState
        title="Ничего не найдено"
        description="Измените поиск или сбросьте фильтры."
        action={
          <Button variant="secondary" onClick={() => setFilters(emptyFilters)}>
            Сбросить фильтры
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<FileText />}
        title="Карт пока нет"
        description="Карта описывает режим одной операции. Нужна деталь с операцией и швом."
        action={
          <Button icon={<Plus />} onClick={newCard}>
            Новая карта
          </Button>
        }
      />
    )
  else body = <CardTable items={list.data} />

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">Технологические карты</h1>
          <p className="text-nav text-muted">
            {list.data
              ? `${list.data.length} ${plural(list.data.length, ['карта', 'карты', 'карт'])}${filtered ? ' по фильтру' : ''}`
              : 'Режимы сварки по операциям'}
          </p>
        </div>
        <Button icon={<Plus />} onClick={newCard}>
          Новая карта
        </Button>
      </div>

      <Card className="p-5">
        {/* === УМНЫЙ ПОИСК === */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Умный поиск"
              placeholder="Например: 12Х18Н10Т 8 мм или деталь АБВ-123"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
              className="pl-9 h-11 text-base"
            />
          </div>

          {/* Чипы распознанных параметров */}
          {hasChips && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Распознано:</span>
              {parsedChips.material && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                  Материал: {parsedChips.material}
                </span>
              )}
              {parsedChips.thickness && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-green-700 ring-1 ring-inset ring-green-600/20">
                  Толщина: {parsedChips.thickness}
                </span>
              )}
            </div>
          )}

          {/* Кнопка расширения фильтров */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {showAdvanced ? 'Скрыть расширенные фильтры' : 'Показать расширенные фильтры'}
          </button>
        </div>

        {/* === РАСШИРЕННЫЕ ФИЛЬТРЫ (Сворачиваемые) === */}
        {showAdvanced && (
          <div className="mb-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <Select aria-label="Деталь" value={filters.part} onChange={(e) => set({ part: e.target.value })}>
              <option value="">Все детали</option>
              {parts.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number} — {p.name}
                </option>
              ))}
            </Select>
            
            <Select
              aria-label="Статус"
              value={filters.released}
              onChange={(e) => set({ released: e.target.value as WeldingCardFilters['released'] })}
            >
              <option value="">Выпущенные и черновики</option>
              <option value="1">Только выпущенные</option>
              <option value="0">Только черновики</option>
            </Select>
            
            <Select aria-label="Процесс" value={filters.process} onChange={(e) => set({ process: e.target.value })}>
              <option value="">Все процессы</option>
              {Object.entries(processLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            
            <Select aria-label="Способ сварки" value={filters.method} onChange={(e) => set({ method: e.target.value })}>
              <option value="">Все способы</option>
              {methods.data
                ?.filter((m) => !filters.process || m.process === filters.process)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.designation ? `${m.designation} — ${m.name}` : m.name}
                  </option>
                ))}
            </Select>
            
            <Select
              aria-label="Оборудование"
              value={filters.equipment}
              onChange={(e) => set({ equipment: e.target.value })}
            >
              <option value="">Всё оборудование</option>
              {equipment.data?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
            
            <Select aria-label="Материал" value={filters.material} onChange={(e) => set({ material: e.target.value })}>
              <option value="">Все материалы</option>
              {materials.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.marka}
                </option>
              ))}
            </Select>
            
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:col-span-2 lg:col-span-1">
              <span className="text-xs text-muted">Толщина</span>
              <DecimalInput
                aria-label="Толщина от, мм"
                placeholder="от"
                digits={7}
                places={2}
                value={filters.thicknessFrom || null}
                onChange={(v) => set({ thicknessFrom: v ?? '' })}
              />
              <span aria-hidden className="text-muted">–</span>
              <DecimalInput
                aria-label="Толщина до, мм"
                placeholder="до"
                digits={7}
                places={2}
                value={filters.thicknessTo || null}
                onChange={(v) => set({ thicknessTo: v ?? '' })}
              />
            </div>
            
            {filtered && (
              <Button variant="ghost" onClick={() => setFilters(emptyFilters)} className="justify-self-start text-red-600 hover:bg-red-50 hover:text-red-700">
                <X className="mr-1 size-4" /> Сбросить всё
              </Button>
            )}
          </div>
        )}

        {body}
      </Card>
    </>
  )
}