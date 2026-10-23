import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { PAYMENT_LABEL, STATUS_LABEL, type OrderStatus, type PaymentStatus } from '@/lib/orders'

/* ---------- toasts ---------- */

type ToastKind = 'ok' | 'error'
interface ToastItem { id: number; msg: string; kind: ToastKind }
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)
  const push = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = ++counter.current
    setItems((s) => [...s.slice(-3), { id, msg, kind }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] grid justify-items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl border-2 border-ink-950 px-4 py-3 text-sm font-semibold shadow-sticker ${t.kind === 'error' ? 'bg-bun text-ink-950' : 'bg-star text-ink-950'}`}>
            {t.kind === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- modal & confirm ---------- */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // keep the latest onClose without re-running the effect (which would steal focus from inputs while typing)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink-950/60" onClick={onClose} aria-hidden="true" />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`card relative max-h-[90dvh] w-full overflow-y-auto p-6 outline-none ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-2xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-950/10 hover:bg-ink-950/20"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', busy, onConfirm, onCancel }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; busy?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="text-sm text-milk/80">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost btn-sm" disabled={busy}>Cancel</button>
        <button onClick={onConfirm} className="btn-pink btn-sm" disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </Modal>
  )
}

/* ---------- layout bits ---------- */

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

const TONES = { plain: 'bg-white', star: 'bg-star/70', pink: 'bg-bun-soft', cloud: 'bg-cloud-soft' } as const
export function StatCard({ label, value, hint, tone = 'plain' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <div className={`card p-5 ${TONES[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-milk/60">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-sm text-milk/65">{hint}</p>}
    </div>
  )
}

export function FieldRow({ label, hint, error, children, className = '' }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-milk/55">{hint}</span>}
      {error && <span role="alert" className="field-error block">{error}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-ink-950 transition disabled:opacity-50 ${checked ? 'bg-star' : 'bg-white'}`}>
      <span className={`absolute left-0.5 h-5 w-5 rounded-full border-2 border-ink-950 bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav aria-label="Pagination" className="mt-5 flex items-center justify-center gap-3">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page" className="btn-ghost btn-sm !px-3"><ChevronLeft className="h-4 w-4" /></button>
      <span className="font-display text-sm font-semibold">Page {page} of {pages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page" className="btn-ghost btn-sm !px-3"><ChevronRight className="h-4 w-4" /></button>
    </nav>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="grid gap-3" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
}

/* ---------- badges ---------- */

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = status === 'cancelled' || status === 'refunded' ? 'badge-muted' : status === 'delivered' ? 'badge-cloud' : status === 'awaiting_payment' || status === 'payment_verification' ? 'badge-star' : 'badge-pink'
  return <span className={tone}>{STATUS_LABEL[status]}</span>
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone = status === 'verified' ? 'badge-cloud' : status === 'submitted' ? 'badge-star' : status === 'failed' ? 'badge-pink' : 'badge-muted'
  return <span className={tone}>{PAYMENT_LABEL[status]}</span>
}
