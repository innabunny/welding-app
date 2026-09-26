import { Check } from 'lucide-react'
import { useEquipmentParameters, useSpeedUnits, useWeldingMethods } from '@/features/equipment/queries'
import { formatNumber } from '@/shared/lib/format'
import type { EquipmentParameterLevel } from '@/shared/types/equipment'
import { Badge } from '@/shared/ui/Badge'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'
import { ReferenceList, Toolbar, type TabProps } from './ReferenceList'

// на бэке эти справочники только для чтения — ведёт администратор в админке
const readOnlyNote = 'Справочник ведёт администратор в админке.'

const processLabels: Record<string, string> = {
  tig: 'Неплавящийся электрод в защитном газе',
  mig: 'Плавящийся электрод в защитном газе',
  plasma: 'Плазменная',
  ebw: 'Электронно-лучевая',
  diff: 'Диффузионная',
  contact: 'Контактная',
  laser: 'Лазерная',
}

const levelLabels: Record<EquipmentParameterLevel, string> = {
  card: 'На всю карту',
  pass: 'На каждый проход',
}

function Note() {
  return <p className="mt-3 text-xs text-muted">{readOnlyNote}</p>
}

export function WeldingMethodsTab({ search, onSearch }: TabProps) {
  const methods = useWeldingMethods()
  return (
    <>
      <Toolbar search={search} onSearch={onSearch} placeholder="Поиск по названию или обозначению" />
      <ReferenceList
        query={methods}
        search={search}
        text={(m) => `${m.designation} ${m.name} ${m.id}`}
        emptyTitle="Способов сварки пока нет"
        emptyDescription={readOnlyNote}
      >
        {(items) => (
          <Table>
            <thead>
              <tr>
                <Th>Обозначение</Th>
                <Th>Название</Th>
                <Th>Процесс</Th>
                <Th>Код</Th>
                <Th>Статус</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <Tr key={m.id} className="hover:bg-surface-2/60">
                  <Td className="font-mono text-xs font-semibold text-primary">{m.designation || '—'}</Td>
                  <Td className="font-semibold">{m.name}</Td>
                  <Td>{processLabels[m.process] ?? m.process}</Td>
                  <Td className="font-mono text-xs text-muted">{m.id}</Td>
                  <Td>
                    <Badge tone={m.isActive ? 'green' : 'gray'}>
                      {m.isActive ? 'Используется' : 'Не используется'}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </ReferenceList>
      <Note />
    </>
  )
}

export function SpeedUnitsTab({ search, onSearch }: TabProps) {
  const units = useSpeedUnits()
  return (
    <>
      <Toolbar search={search} onSearch={onSearch} placeholder="Поиск по обозначению" />
      <ReferenceList
        query={units}
        search={search}
        text={(u) => `${u.name} ${u.code}`}
        emptyTitle="Единиц скорости пока нет"
        emptyDescription={readOnlyNote}
      >
        {(items) => (
          <Table>
            <thead>
              <tr>
                <Th>Обозначение</Th>
                <Th>Код</Th>
                <Th>Вид</Th>
                <Th className="text-right">Множитель к м/ч</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <Tr key={u.id} className="hover:bg-surface-2/60">
                  <Td className="font-semibold">{u.name}</Td>
                  <Td className="font-mono text-xs text-muted">{u.code}</Td>
                  <Td>
                    {u.isAngular ? (
                      <Badge tone="blue">угловая</Badge>
                    ) : (
                      <Badge tone="gray">линейная</Badge>
                    )}
                  </Td>
                  <Td className="text-right font-mono">
                    {u.isAngular ? (
                      <span className="text-xs text-muted">по диаметру шва</span>
                    ) : (
                      formatNumber(u.toMPerH, 8)
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </ReferenceList>
      <Note />
    </>
  )
}

export function EquipmentParametersTab({ search, onSearch }: TabProps) {
  const parameters = useEquipmentParameters()
  return (
    <>
      <Toolbar search={search} onSearch={onSearch} placeholder="Поиск по названию" />
      <ReferenceList
        query={parameters}
        search={search}
        text={(p) => `${p.name} ${p.code}`}
        emptyTitle="Параметров пока нет"
        emptyDescription={readOnlyNote}
      >
        {(items) => (
          <Table>
            <thead>
              <tr>
                <Th>Параметр</Th>
                <Th>Единица</Th>
                <Th>Уровень</Th>
                <Th>В техкарте</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <Tr key={p.id} className="hover:bg-surface-2/60">
                  <Td>
                    <span className="font-semibold">{p.name}</span>
                    <span className="block font-mono text-xs text-muted">{p.code}</span>
                  </Td>
                  <Td>{p.unit || '—'}</Td>
                  <Td>{levelLabels[p.level] ?? p.level}</Td>
                  <Td>
                    {p.printed ? (
                      <Check className="size-4 text-success" aria-label="Печатается" />
                    ) : (
                      <span className="text-muted">не печатается</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </ReferenceList>
      <Note />
    </>
  )
}
