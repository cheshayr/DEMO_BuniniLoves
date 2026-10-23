import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, PackageX } from 'lucide-react'
import { fetchDashboard, fetchRecentOrders } from '@/lib/admin'
import type { Dashboard } from '@/lib/admin'
import { formatDate, formatPHP } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { PAYMENT_LABEL } from '@/lib/orders'
import type { OrderRow } from '@/lib/orders'
import { ErrorState } from '@/components/ui/States'
import { ListSkeleton, OrderStatusBadge, PageHeader, StatCard } from '@/components/admin/ui'

const dayLabel = (iso: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(`${iso}T00:00:00`))

/** 14-day revenue bars. Plain SVG: no chart library needed. */
function RevenueChart({ daily }: { daily: Dashboard['daily'] }) {
  const max = Math.max(...daily.map((d) => d.revenue), 0)
  const W = 700, H = 190, PAD_B = 28, PAD_T = 10
  const slot = W / daily.length
  const bar = slot * 0.62
  const total = daily.reduce((s, d) => s + d.revenue, 0)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Paid revenue for the last 14 days, ${formatPHP(total)} in total`} className="w-full">
        <line x1="0" x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke="#2b1a2e" strokeWidth="2" />
        {daily.map((d, i) => {
          const h = max > 0 ? Math.max(d.revenue > 0 ? 4 : 0, (d.revenue / max) * (H - PAD_B - PAD_T)) : 0
          const x = i * slot + (slot - bar) / 2
          return (
            <g key={d.day}>
              <rect x={x} y={H - PAD_B - h} width={bar} height={h} rx="5" fill="#ffe566" stroke="#2b1a2e" strokeWidth={h > 0 ? 2 : 0}>
                <title>{`${dayLabel(d.day)}: ${formatPHP(d.revenue)} · ${d.orders} order${d.orders === 1 ? '' : 's'}`}</title>
              </rect>
              {(i % 2 === 0 || daily.length < 8) && <text x={x + bar / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="#2b1a2e" opacity=".65">{dayLabel(d.day).replace(' ', ' ')}</text>}
            </g>
          )
        })}
      </svg>
      {max === 0 && <p className="mt-2 text-center text-sm text-milk/60">No paid orders in the last 14 days yet.</p>}
    </div>
  )
}

function Attention({ to, icon, label, count, tone }: { to: string; icon: ReactNode; label: string; count: number; tone: string }) {
  return (
    <Link to={to} className={`card card-hover flex items-center justify-between gap-3 p-4 ${count > 0 ? tone : 'bg-white'}`}>
      <span className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink-950 bg-white">{icon}</span>
        <span><span className="block font-display text-2xl font-semibold leading-none">{count}</span><span className="text-sm font-semibold text-milk/75">{label}</span></span>
      </span>
      <ChevronRight className="h-5 w-5" />
    </Link>
  )
}

export default function Overview() {
  const { data, loading, error } = useAsync(async () => {
    const [dash, recent] = await Promise.all([fetchDashboard(), fetchRecentOrders(6)])
    return { dash, recent }
  }, [])

  if (loading) return <><PageHeader eyebrow="owner studio" title="overview" /><ListSkeleton rows={4} /></>
  if (error || !data) return <><PageHeader eyebrow="owner studio" title="overview" /><ErrorState message={error ?? 'Could not load the dashboard.'} /></>

  const { dash, recent } = data
  const s = dash.by_status
  const toVerify = s.payment_verification ?? 0
  const toPack = (s.processing ?? 0) + (s.packed ?? 0) + (s.pending ?? 0)

  return (
    <>
      <PageHeader eyebrow="owner studio" title="overview" />

      <section aria-label="Revenue" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Paid today" value={formatPHP(dash.revenue_today)} tone="star" />
        <StatCard label="Last 7 days" value={formatPHP(dash.revenue_7d)} />
        <StatCard label="Last 30 days" value={formatPHP(dash.revenue_30d)} />
        <StatCard label="Orders today" value={dash.orders_today} hint={`${dash.customers} customer${dash.customers === 1 ? '' : 's'} total`} tone="cloud" />
      </section>

      <section aria-label="Needs attention" className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold">needs your attention</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Attention to="/admin/orders?status=payment_verification" icon={<AlertTriangle className="h-5 w-5" />} label="payments to verify" count={toVerify} tone="bg-star/70" />
          <Attention to="/admin/orders?status=todo" icon={<span className="text-lg">📦</span>} label="orders to prepare" count={toPack} tone="bg-bun-soft" />
          <Attention to="/admin/inventory" icon={<AlertTriangle className="h-5 w-5" />} label="running low" count={dash.low_stock} tone="bg-star/70" />
          <Attention to="/admin/inventory" icon={<PackageX className="h-5 w-5" />} label="out of stock" count={dash.out_of_stock} tone="bg-bun-soft" />
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="card p-5" aria-label="Revenue chart">
          <h2 className="font-display text-xl font-semibold">paid revenue, last 14 days</h2>
          <p className="mb-3 text-xs text-milk/55">Counts orders whose payment is verified (or cash delivered). Cancelled and refunded orders are left out.</p>
          <RevenueChart daily={dash.daily} />
        </section>

        <section className="card p-5" aria-label="Top products">
          <h2 className="font-display text-xl font-semibold">best sellers · 30 days</h2>
          {dash.top_products.length === 0 ? <p className="mt-3 text-sm text-milk/60">Nothing sold yet.</p> : (
            <ol className="mt-3 grid gap-3">
              {dash.top_products.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink-950 bg-star font-display text-sm font-semibold">{i + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{p.name}</span><span className="text-xs text-milk/60">{p.qty} sold</span></span>
                  <span className="font-display font-semibold">{formatPHP(p.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="mt-6" aria-label="Recent orders">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">latest orders</h2>
          <Link to="/admin/orders" className="text-sm font-bold text-bun-ribbon hover:underline">See all →</Link>
        </div>
        {recent.length === 0 ? <p className="card p-6 text-center text-sm text-milk/60">No orders yet. They will appear here the moment someone checks out.</p> : (
          <ul className="grid gap-3">
            {recent.map((o: OrderRow) => (
              <li key={o.id}>
                <Link to={`/admin/orders/${o.id}`} className="card card-hover flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-display text-lg font-semibold">{o.order_number} <span className="text-sm font-normal text-milk/60">· {o.ship_name}</span></p>
                    <p className="text-sm text-milk/65">{formatDate(o.created_at, { dateStyle: 'medium', timeStyle: 'short' })} · {PAYMENT_LABEL[o.payment_status]}</p>
                  </div>
                  <div className="flex items-center gap-3"><OrderStatusBadge status={o.status} /><span className="font-display text-lg font-semibold">{formatPHP(o.total_centavos)}</span></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
