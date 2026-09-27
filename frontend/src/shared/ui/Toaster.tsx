import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useToasts } from '@/shared/lib/toast'
import { cn } from '@/shared/lib/cn'

/**
 * Уведомления снизу по центру. Не перехватывают клики мимо себя
 * и не блокируют интерфейс; скринридер зачитывает их сам (aria-live).
 */
export function Toaster() {
  const { items, dismiss } = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex max-w-[min(440px,100%)] animate-toast-in items-center gap-2.5 rounded-control border bg-surface py-2.5 pl-3.5 pr-2 text-sm shadow-card',
            t.tone === 'error' ? 'border-danger/40' : 'border-border',
          )}
        >
          {t.tone === 'error' ? (
            <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
          )}
          <span className="min-w-0 flex-1">{t.text}</span>
          <button
            type="button"
            aria-label="Закрыть уведомление"
            onClick={() => dismiss(t.id)}
            className="grid size-7 shrink-0 place-items-center rounded-tag text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
