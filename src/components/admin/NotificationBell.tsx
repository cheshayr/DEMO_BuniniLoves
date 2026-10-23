import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { acknowledgeAllNotifications, acknowledgeNotification, fetchNotifications, type NotificationRow } from '@/lib/admin'
import { formatDate } from '@/lib/format'

const linkFor = (n: NotificationRow) => (n.order_id ? `/admin/orders/${n.order_id}` : '/admin/inventory')

/** Owner alerts: new orders, payment proofs to check, low / out-of-stock. Checks again every minute. */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const load = useCallback(() => { fetchNotifications().then(setItems).catch(() => { /* keep the last list */ }) }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const unread = items.filter((n) => !n.acknowledged_at).length

  const markOne = (n: NotificationRow) => {
    setOpen(false)
    if (n.acknowledged_at) return
    setItems((s) => s.map((x) => (x.id === n.id ? { ...x, acknowledged_at: new Date().toISOString() } : x)))
    acknowledgeNotification(n.id).catch(load)
  }
  const markAll = () => {
    setItems((s) => s.map((x) => ({ ...x, acknowledged_at: x.acknowledged_at ?? new Date().toISOString() })))
    acknowledgeAllNotifications().catch(load)
  }

  return (
    <div ref={root} className="relative">
      <button onClick={() => { setOpen((o) => !o); if (!open) load() }} aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'} aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-ink-950/10">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink-950 bg-bun-deep px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="card absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden">
          <div className="flex items-center justify-between border-b-2 border-ink-950 px-4 py-3">
            <h2 className="font-display text-lg font-semibold">notifications</h2>
            {unread > 0 && <button onClick={markAll} className="inline-flex items-center gap-1 text-xs font-bold text-bun-ribbon hover:underline"><CheckCheck className="h-4 w-4" /> Mark all read</button>}
          </div>
          <ul className="max-h-[26rem] overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-milk/60">Nothing yet. New orders and stock alerts show up here.</li>}
            {items.map((n) => (
              <li key={n.id} className="border-b border-ink-950/10 last:border-0">
                <Link to={linkFor(n)} onClick={() => markOne(n)} className={`flex gap-3 px-4 py-3 hover:bg-star/30 ${n.acknowledged_at ? 'opacity-60' : ''}`}>
                  <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.acknowledged_at ? 'bg-ink-950/20' : n.kind === 'out_of_stock' ? 'bg-bun-deep' : 'bg-star ring-2 ring-ink-950'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-milk/65">{n.body}</span>}
                    <span className="block text-xs text-milk/45">{formatDate(n.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
