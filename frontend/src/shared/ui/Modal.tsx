import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/** На нативном <dialog>: фокус внутри, Esc и подложка — от браузера */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
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
      className="m-auto w-[min(640px,calc(100vw-32px))] rounded-card border border-border bg-surface p-0 text-text shadow-card backdrop:bg-text/40"
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-64px)] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <h2 className="text-lg font-heading">{title}</h2>
            <IconButton label="Закрыть" onClick={onClose}>
              <X />
            </IconButton>
          </header>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  )
}
