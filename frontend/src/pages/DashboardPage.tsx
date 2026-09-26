import { AttentionTiles } from '@/features/dashboard/AttentionTiles'
import { AttestationPanel } from '@/features/dashboard/AttestationPanel'
import { DeviationPanel } from '@/features/dashboard/DeviationPanel'
import { EquipmentFleet } from '@/features/dashboard/EquipmentFleet'
import { QuickAccess } from '@/features/dashboard/QuickAccess'
import { RecentWelds } from '@/features/dashboard/RecentWelds'
import { useSession } from '@/shared/api/session'
import { formatLongDate } from '@/shared/lib/format'

function greeting(hour: number): string {
  if (hour < 5) return 'Доброй ночи'
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

/** «Гостева Инна Сергеевна» → «Инна»; «Инна Г.» → «Инна» */
function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return (parts.length === 3 ? parts[1] : parts[0]) ?? ''
}

export function DashboardPage() {
  const user = useSession((s) => s.user)
  const now = new Date()
  const name = user ? firstName(user.name) || user.login : ''

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="mb-1 text-xl font-heading tracking-heading sm:text-2xl">
            {greeting(now.getHours())}
            {name && `, ${name}`}
          </h1>
          <p className="text-nav text-muted">Что требует внимания сегодня</p>
        </div>
        <div className="rounded-control border border-border bg-surface px-3 py-2 text-caption text-muted">
          {formatLongDate(now)}
        </div>
      </div>

      <AttentionTiles />

      <section className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,.9fr)]">
        <DeviationPanel />
        <AttestationPanel />
      </section>

      <section className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <QuickAccess />
        <RecentWelds />
      </section>

      <EquipmentFleet />
    </>
  )
}
