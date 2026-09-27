import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { IconButton } from './Button'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Цветная шапка с иконкой и подписью — для главных действий раздела */
  accent?: { icon: ReactNode; subtitle?: string }
  className?: string
}

/**
 * На нативном <dialog>: фокус внутри, Esc и подложка — от браузера.
 *
 * Колонка из трёх частей с ограничением высоты: шапка и кнопки не
 * сжимаются, прокручивается только тело. min-h-0 у тела обязателен —
 * без него flex-элемент не становится меньше содержимого, и при длинном
 * тексте кнопки уезжают за нижний край экрана.
 */
export function Modal({ open, title, onClose, children, footer, accent, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={cn(
        'm-auto max-h-[90dvh] w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-card border border-border bg-surface p-0 text-text shadow-card backdrop:bg-text/40',
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          {accent ? (
            <header className="flex shrink-0 items-start gap-3.5 bg-gradient-to-br from-primary to-teal px-5 py-4 text-white">
              <span className="grid size-11 shrink-0 place-items-center rounded-box bg-white/20 [&_svg]:size-[22px]">
                {accent.icon}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="text-lg font-heading">{title}</h2>
                {accent.subtitle && <p className="mt-0.5 text-caption text-white/85">{accent.subtitle}</p>}
              </div>
              <IconButton
                label="Закрыть"
                onClick={onClose}
                className="border-white/30 bg-white/10 text-white hover:border-white hover:bg-white/20 hover:text-white"
              >
                <X />
              </IconButton>
            </header>
          ) : (
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
              <h2 className="text-lg font-heading">{title}</h2>
              <IconButton label="Закрыть" onClick={onClose}>
                <X />
              </IconButton>
            </header>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  )
}
