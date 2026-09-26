import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/shared/api/session'
import { cn } from '@/shared/lib/cn'
import { paths } from './navigation'
import { Sidebar } from './Sidebar'
import { useSidebar } from './sidebarStore'
import { Topbar } from './Topbar'

export function AppLayout() {
  const token = useSession((s) => s.token)
  const location = useLocation()
  const sidebarHidden = useSidebar((s) => s.hidden)

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
      <main className="min-w-0">
        <Topbar />
        <div className="mx-auto max-w-content px-4 pb-10 pt-5 md:px-7 md:pb-12 md:pt-[26px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
