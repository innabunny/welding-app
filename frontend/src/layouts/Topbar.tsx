import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'
import { useMatches } from 'react-router'
import { fmtDate } from '@/features/telemetry/format'
import { useNow } from '@/features/telemetry/useNow'
import { useTheme } from '@/shared/lib/theme'
import { IconButton } from '@/shared/ui/Button'
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

/** Часы — как в референсе телеметрии: «13:31:14 МСК · пт, 16.10.2026» */
function Clock() {
  const now = useNow()
  return (
    <span className="hidden items-baseline gap-2 font-plex-mono tabular-nums sm:flex">
      <span className="text-[18px] text-text">
        {new Date(now).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className="text-[13px] text-muted">
        {zoneLabel(now)} · {fmtDate(now)}
      </span>
    </span>
  )
}

/** Шапка портала — одна на все разделы: название, раздел, часы, тема */
export function Topbar() {
  const crumb = useCrumb()
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  const { hidden: sidebarHidden, toggle: toggleSidebar } = useSidebar()

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 flex h-topbar items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur md:px-7">
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
        <span className="truncate font-cond text-[20px] font-semibold uppercase tracking-[0.06em] text-text">
          Сварочное производство
        </span>
        {/* раздел — мелко рядом, чтобы было понятно, где находишься */}
        {crumb && (
          <span className="hidden min-w-0 items-center gap-3 truncate text-sm text-muted lg:flex">
            <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
            {crumb}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <Clock />
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
