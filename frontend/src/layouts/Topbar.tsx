import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'
import { useLocation, useMatches } from 'react-router'
import { fmtDate } from '@/features/telemetry/format'
import { useNow } from '@/features/telemetry/useNow'
import { useTheme } from '@/shared/lib/theme'
import { IconButton } from '@/shared/ui/Button'
import { paths } from './navigation'
import { SIDEBAR_ID } from './Sidebar'
import { useSidebar } from './sidebarStore'

export interface RouteHandle {
  crumb: string
}

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return typeof handle === 'object' && handle !== null && 'crumb' in handle
}

function useCrumb(): string {
  const matches = useMatches()
  const last = [...matches].reverse().find((m) => isRouteHandle(m.handle))
  return last && isRouteHandle(last.handle) ? last.handle.crumb : ''
}

/** Часовой пояс браузера: «МСК» для Москвы, иначе «UTC+5» */
function zoneLabel(at: number): string {
  const hours = -new Date(at).getTimezoneOffset() / 60
  if (hours === 3) return 'МСК'
  return `UTC${hours >= 0 ? '+' : '−'}${Math.abs(hours)}`
}

/** Часы в шапке телеметрии — как в референсе: «13:31:14 МСК · пт, 16.10.2026» */
function Clock() {
  const now = useNow()
  return (
    <span className="hidden items-baseline gap-2 sm:flex">
      <span className="tnum font-mono text-[18px] text-text">
        {new Date(now).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className="tnum font-mono text-[14px] text-muted">
        {zoneLabel(now)} · {fmtDate(now)}
      </span>
    </span>
  )
}

export function Topbar() {
  const telemetry = useLocation().pathname.startsWith(paths.telemetry)
  const crumb = useCrumb()
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  const { hidden: sidebarHidden, toggle: toggleSidebar } = useSidebar()

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 flex h-topbar items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          label={sidebarHidden ? 'Показать меню' : 'Скрыть меню'}
          aria-expanded={!sidebarHidden}
          aria-controls={SIDEBAR_ID}
          onClick={toggleSidebar}
          className="hidden md:grid"
        >
          {sidebarHidden ? <PanelLeftOpen strokeWidth={1.8} /> : <PanelLeftClose strokeWidth={1.8} />}
        </IconButton>
        {telemetry ? (
          <span className="label truncate text-[20px] text-text">Сварочное производство</span>
        ) : (
          <nav aria-label="Хлебные крошки" className="truncate text-sm text-muted">
            Портал / <strong className="font-semibold text-text">{crumb}</strong>
          </nav>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {telemetry && <Clock />}
        <button
        type="button"
        onClick={toggle}
        aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
        className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface py-[5px] pl-2 pr-3 text-caption text-text hover:border-primary"
      >
        {dark ? <Moon className="size-4" strokeWidth={1.8} /> : <Sun className="size-4" strokeWidth={1.8} />}
        {dark ? 'Тёмная' : 'Светлая'}
        </button>
      </div>
    </header>
  )
}
