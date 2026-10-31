import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import { Toaster } from '@/shared/ui/Toaster'
import { paths } from './navigation'
import { Sidebar } from './Sidebar'
import { useSidebar } from './sidebarStore'
import { Topbar } from './Topbar'

export function AppLayout() {
  const token = useSession((s) => s.token)
  const location = useLocation()
  const sidebarHidden = useSidebar((s) => s.hidden)
  // телеметрия оформлена по референсу заказчика: тёмная, своя палитра и шрифты
  const telemetry = location.pathname.startsWith(paths.telemetry)

  if (!token) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${paths.login}?next=${next}`} replace />
  }

  return (
    <div
      className={cn(
        'grid min-h-screen grid-cols-1 grid-rows-[auto_1fr] md:grid-rows-1',
        !sidebarHidden && 'md:grid-cols-app',
      )}
    >
      <Sidebar hidden={sidebarHidden} />
      <main className={cn('min-w-0', telemetry && 'tm')}>
        <Topbar />
        <div className="mx-auto max-w-content px-4 pb-10 pt-5 md:px-7 md:pb-12 md:pt-[26px]">
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  )
}
