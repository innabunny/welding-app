import { useNavigate } from 'react-router'
import { formatDate } from '@/shared/lib/format'
import type { WeldingCardListItem } from '@/shared/types/weldingCards'
import { Badge } from '@/shared/ui/Badge'
import { Table, Td, Th, Tr } from '@/shared/ui/Table'
import { materialsText, thicknessText } from './format'

export function CardTable({ items }: { items: WeldingCardListItem[] }) {
  const navigate = useNavigate()
  return (
    <Table>
      <thead>
        <tr>
          <Th>№ карты</Th>
          <Th>Деталь</Th>
          <Th>Операция</Th>
          <Th>Шов</Th>
          <Th className="text-right">Толщина, мм</Th>
          <Th>Материалы</Th>
          <Th>Способ</Th>
          <Th>Оборудование</Th>
          <Th className="text-right">Проходов</Th>
          <Th>Статус</Th>
          <Th>Автор</Th>
          <Th>Создана</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((c) => (
          <Tr
            key={c.id}
            className="cursor-pointer hover:bg-surface-2/60"
            onClick={() => navigate(`/cards/${c.id}`)}
          >
            <Td>
              {/* ссылка — чтобы строку можно было открыть с клавиатуры и в новой вкладке */}
              <a
                href={`/cards/${c.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  navigate(`/cards/${c.id}`)
                }}
                className="font-mono font-semibold hover:text-primary"
              >
                {c.cardNo}
              </a>
              {c.revision > 1 && <span className="block text-xs text-muted">ред. {c.revision}</span>}
            </Td>
            <Td>
              <span className="font-mono text-xs font-semibold">{c.partNumber}</span>
              <span className="block max-w-[220px] truncate text-xs text-muted" title={c.partName}>
                {c.partName}
              </span>
            </Td>
            <Td className="font-mono">{c.operationNumber}</Td>
            <Td className="font-mono">{c.seamNumber}</Td>
            <Td className="text-right font-mono">{thicknessText(c.seamThickness1, c.seamThickness2)}</Td>
            <Td>{materialsText(c.material1Marka, c.material2Marka)}</Td>
            <Td className="max-w-[240px]">{c.methodName}</Td>
            <Td>{c.equipmentName || <span className="text-muted">—</span>}</Td>
            <Td className="text-right font-mono">{c.passesCount}</Td>
            <Td>
              <Badge tone={c.isReleased ? 'green' : 'yellow'}>{c.isReleased ? 'Выпущена' : 'Черновик'}</Badge>
            </Td>
            <Td className="whitespace-nowrap">{c.authorName || <span className="text-muted">—</span>}</Td>
            <Td className="whitespace-nowrap">{formatDate(c.createdAt)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}
