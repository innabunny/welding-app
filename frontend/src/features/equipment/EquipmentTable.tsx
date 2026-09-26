import { Pencil } from 'lucide-react'
import type { Equipment, SpeedUnit } from '@/shared/types/equipment'
import { Badge } from '@/shared/ui/Badge'
import { IconButton } from '@/shared/ui/Button'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'

interface Props {
  items: Equipment[]
  speedUnits: SpeedUnit[]
  onEdit: (id: number) => void
}

export function EquipmentTable({ items, speedUnits, onEdit }: Props) {
  const unitName = new Map(speedUnits.map((u) => [u.id, u.name]))

  return (
    <Table>
      <thead>
        <tr>
          <Th>Установка</Th>
          <Th>Способ сварки</Th>
          <Th>Рабочее место</Th>
          <Th>Единицы скорости</Th>
          <Th>Телеметрия</Th>
          <Th>Статус</Th>
          <Th className="w-12">
            <span className="sr-only">Действия</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const units = item.speedUnits.map((id) => unitName.get(id)).filter(Boolean)
          const place = [item.workshopName, item.sectionName].filter(Boolean).join(' · ')
          return (
            <Tr key={item.id} className="hover:bg-surface-2/60">
              <Td>
                <button
                  type="button"
                  onClick={() => onEdit(item.id)}
                  className="text-left font-semibold hover:text-primary"
                >
                  {item.name}
                </button>
                {item.hasPulse && <span className="block text-xs text-muted">импульсный режим</span>}
              </Td>
              <Td>
                {item.methodDesignation && (
                  <span className="mr-1.5 font-mono text-xs font-semibold text-primary">
                    {item.methodDesignation}
                  </span>
                )}
                {item.methodName}
              </Td>
              <Td>
                {item.workstationNumber ? (
                  <>
                    Пост {item.workstationNumber}
                    {place && <span className="block text-xs text-muted">{place}</span>}
                  </>
                ) : (
                  <span className="text-muted">не привязана</span>
                )}
              </Td>
              <Td>
                {units.length > 0 ? (
                  units.join(', ')
                ) : (
                  <Badge tone="yellow">не заданы</Badge>
                )}
              </Td>
              <Td>
                {item.nodeId ? (
                  <span className="font-mono text-xs">
                    {item.nodeId}
                    {item.nodeIp && <span className="block text-muted">{item.nodeIp}</span>}
                  </span>
                ) : (
                  <span className="text-muted">не подключена</span>
                )}
              </Td>
              <Td>
                <Badge tone={item.isActive ? 'green' : 'gray'}>
                  {item.isActive ? 'В работе' : 'Не в работе'}
                </Badge>
              </Td>
              <Td>
                <IconButton label={`Изменить «${item.name}»`} onClick={() => onEdit(item.id)}>
                  <Pencil />
                </IconButton>
              </Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}
