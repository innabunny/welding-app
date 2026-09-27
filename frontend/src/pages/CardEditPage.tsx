import { useParams, useSearchParams } from 'react-router'
import { CardForm } from '@/features/weldingCards/CardForm'
import { useWeldingCard } from '@/features/weldingCards/queries'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

/** /cards/new — новая карта, /cards/:id — правка */
export function CardEditPage() {
  // у маршрута /cards/new параметра id нет вовсе — это новая карта
  const { id } = useParams()
  const isNew = id === undefined || id === 'new'
  const cardId = isNew ? null : Number(id)
  const card = useWeldingCard(Number.isInteger(cardId) ? cardId : null)
  // «Составить карту» из маршрута детали: деталь и операция уже выбраны
  const [params] = useSearchParams()
  const presetPart = Number(params.get('part'))
  const presetOperation = Number(params.get('operation'))
  const preset =
    Number.isInteger(presetPart) && presetPart > 0 && Number.isInteger(presetOperation) && presetOperation > 0
      ? { partId: presetPart, operationId: presetOperation }
      : undefined

  if (!isNew && !Number.isInteger(cardId))
    return <EmptyState title="Карта не найдена" description="В адресе нет номера карты." />
  // новая карта: форма с чистого черновика; key сбрасывает её при переходе
  if (cardId === null) return <CardForm key={`new-${preset?.operationId ?? ''}`} card={undefined} preset={preset} />
  if (card.isPending) return <SkeletonRows rows={8} />
  if (card.isError) return <ErrorState error={card.error} onRetry={() => card.refetch()} />
  return <CardForm key={card.data.id} card={card.data} />
}
