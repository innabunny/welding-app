import { Hammer } from 'lucide-react'
import { EmptyState } from '@/shared/ui/States'

export function StubPage({ title }: { title: string }) {
  return (
    <>
      <h1 className="mb-[22px] text-xl font-heading tracking-heading md:text-2xl">{title}</h1>
      <EmptyState
        icon={<Hammer />}
        title="Раздел в разработке"
        description="Здесь появится рабочая страница. Пока данные можно смотреть в админке."
      />
    </>
  )
}
