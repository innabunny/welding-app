import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/shared/api/session'
import { paths } from './navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout() {
  const token = useSession((s) => s.token)
  const location = useLocation()

  if (!token) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${paths.login}?next=${next}`} replace />
  }

  return (
    <div className="grid min-h-screen grid-cols-1 grid-rows-[auto_1fr] md:grid-cols-app md:grid-rows-1">
      <Sidebar />
      <main className="min-w-0">
        <Topbar />
        <div className="mx-auto max-w-content px-4 pb-10 pt-5 md:px-7 md:pb-12 md:pt-[26px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
