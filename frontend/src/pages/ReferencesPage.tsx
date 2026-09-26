import { useState, type ComponentType } from 'react'
import { useSearchParams } from 'react-router'
import {
  EquipmentParametersTab,
  SpeedUnitsTab,
  WeldingMethodsTab,
} from '@/features/references/EquipmentTabs'
import {
  FillerMaterialsTab,
  GasFluxTab,
  MaterialGroupsTab,
  MaterialsTab,
} from '@/features/references/MaterialTabs'
import type { TabProps } from '@/features/references/ReferenceList'
import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import { Card } from '@/shared/ui/Card'

interface Tab {
  id: string
  label: string
  component: ComponentType<TabProps>
}

const groups: { title: string; tabs: Tab[] }[] = [
  {
    title: 'Материалы',
    tabs: [
      { id: 'materials', label: 'Основные материалы', component: MaterialsTab },
      { id: 'groups', label: 'Группы материалов', component: MaterialGroupsTab },
      { id: 'fillers', label: 'Сварочные материалы', component: FillerMaterialsTab },
      { id: 'gas-flux', label: 'Газы и флюсы', component: GasFluxTab },
    ],
  },
  {
    title: 'Сварка и оборудование',
    tabs: [
      { id: 'methods', label: 'Способы сварки', component: WeldingMethodsTab },
      { id: 'speed-units', label: 'Единицы скорости', component: SpeedUnitsTab },
      { id: 'parameters', label: 'Параметры оборудования', component: EquipmentParametersTab },
    ],
  },
]

const allTabs = groups.flatMap((g) => g.tabs)

export function ReferencesPage() {
  // вкладка в адресе: ссылкой можно поделиться, «назад» возвращает на прошлую
  const [params, setParams] = useSearchParams()
  const active = allTabs.find((t) => t.id === params.get('tab')) ?? allTabs[0]!
  const [search, setSearch] = useState('')
  // материалы на бэке правит только администратор
  const canEdit = useSession((s) => s.user?.role === 'admin')

  const select = (id: string) => {
    setSearch('')
    setParams({ tab: id })
  }

  const Active = active.component

  return (
    <>
      <div className="mb-[22px]">
        <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">Справочники</h1>
        <p className="text-nav text-muted">
          {canEdit
            ? 'Материалы, способы сварки и параметры оборудования'
            : 'Просмотр. Изменять справочники может администратор'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Справочники" className="flex gap-5 overflow-x-auto lg:flex-col lg:overflow-visible">
          {groups.map((group) => (
            <div key={group.title} className="shrink-0">
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {group.title}
              </p>
              <ul className="flex gap-1 lg:flex-col">
                {group.tabs.map((tab) => (
                  <li key={tab.id}>
                    <button
                      type="button"
                      aria-current={tab.id === active.id ? 'page' : undefined}
                      onClick={() => select(tab.id)}
                      className={cn(
                        'w-full whitespace-nowrap rounded-control px-3 py-2 text-left text-sm transition-colors',
                        tab.id === active.id
                          ? 'bg-primary-soft font-semibold text-primary'
                          : 'text-text hover:bg-surface-2',
                      )}
                    >
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <Card className="min-w-0 p-5">
          <h2 className="mb-4 text-lg font-heading">{active.label}</h2>
          <Active key={active.id} search={search} onSearch={setSearch} canEdit={canEdit} />
        </Card>
      </div>
    </>
  )
}
