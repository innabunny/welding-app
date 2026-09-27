import { ArrowLeft, Printer } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { isMethodCode } from '@/features/weldingCards/fields'
import { useOperation, useSeam, useWeldingCard } from '@/features/weldingCards/queries'
import { CardSheet } from '@/features/weldingCards/sheet/CardSheet'
import { printSheet } from '@/features/weldingCards/sheet/print'
import sheetCss from '@/features/weldingCards/sheet/sheet.css?raw'
import { Button } from '@/shared/ui/Button'
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui/States'

export function CardSheetPage() {
  const navigate = useNavigate()
  const id = Number(useParams().id)
  const card = useWeldingCard(Number.isInteger(id) ? id : null)
  // позиции и длина шва есть только у самого шва — идём по цепочке
  const operation = useOperation(card.data?.operationId ?? null)
  const seam = useSeam(operation.data?.seamId)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [blocked, setBlocked] = useState(false)

  if (!Number.isInteger(id)) return <EmptyState title="Карта не найдена" />
  if (card.isPending) return <SkeletonRows rows={8} />
  if (card.isError) return <ErrorState error={card.error} onRetry={() => card.refetch()} />

  const method = card.data.methodId
  const print = () => {
    if (sheetRef.current) setBlocked(!printSheet(sheetRef.current, sheetCss, `Техкарта № ${card.data.cardNo}`))
  }

  return (
    <>
      {/* стили бланка — те же, что уйдут в окно печати */}
      <style>{sheetCss}</style>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">Бланк карты № {card.data.cardNo}</h1>
          <p className="text-nav text-muted">
            Последняя сохранённая версия{card.data.isReleased ? '' : ' · черновик'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<ArrowLeft />} onClick={() => navigate(`/cards/${id}`)}>
            К карте
          </Button>
          <Button icon={<Printer />} onClick={print} disabled={!isMethodCode(method)}>
            Печать
          </Button>
        </div>
      </div>
      {blocked && (
        <p role="alert" className="mb-4 rounded-control bg-warning-soft px-3 py-2 text-sm text-warning">
          Браузер заблокировал окно печати. Разрешите всплывающие окна для этого сайта и нажмите «Печать» ещё раз.
        </p>
      )}
      {isMethodCode(method) ? (
        // бланк — лист бумаги: светлый в любой теме, скролл по ширине на узком экране
        <div className="overflow-x-auto rounded-card border border-border bg-white p-4 shadow-card">
          {/* бланк свёрстан под лист: на узком экране не сжимаем, а прокручиваем */}
          <div className="min-w-[1000px]">
            <CardSheet ref={sheetRef} card={card.data} method={method} seam={seam.data} />
          </div>
        </div>
      ) : (
        <EmptyState title="Бланк не собрать" description={`Для способа «${method}» нет описи полей.`} />
      )}
    </>
  )
}
