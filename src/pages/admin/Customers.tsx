import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, Search } from 'lucide-react'
import { fetchCustomers } from '@/lib/admin'
import { downloadCsv } from '@/lib/csv'
import { downloadPdf, pdfMoney } from '@/lib/pdf'
import { formatDate, formatPHP } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ListSkeleton, PageHeader, StatCard } from '@/components/admin/ui'

type Sort = 'new' | 'spent' | 'orders'

export default function AdminCustomers() {
  const { data, loading, error } = useAsync(fetchCustomers, [])
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('new')

  if (loading) return <><PageHeader eyebrow="people" title="customers" /><ListSkeleton rows={6} /></>
  if (error || !data) return <><PageHeader eyebrow="people" title="customers" /><ErrorState message={error ?? 'Could not load customers.'} /></>

  const term = q.trim().toLowerCase()
  const shown = data
    .filter((c) => !term || `${c.full_name} ${c.email}`.toLowerCase().includes(term))
    .sort((a, b) =>
      sort === 'spent' ? b.total_spent_centavos - a.total_spent_centavos
        : sort === 'orders' ? b.order_count - a.order_count
        : new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())

  const withOrders = data.filter((c) => c.order_count > 0).length
  const lifetime = data.reduce((s, c) => s + c.total_spent_centavos, 0)

  const exportCsv = () => {
    const header = ['Name', 'Email', 'Registered (PH time)', 'Orders', 'Paid total (PHP)', 'Last order (PH time)']
    const rows = shown.map((c) => [
      c.full_name || '(no name)', c.email,
      formatDate(c.registered_at, { dateStyle: 'medium', timeZone: 'Asia/Manila' }),
      c.order_count, c.total_spent_centavos / 100,
      c.last_order_at ? formatDate(c.last_order_at, { dateStyle: 'medium', timeZone: 'Asia/Manila' }) : '',
    ])
    downloadCsv(`bunini-customers-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
  }

  const exportPdf = () => {
    const day = (iso: string) => formatDate(iso, { dateStyle: 'medium', timeZone: 'Asia/Manila' })
    downloadPdf(`bunini-customers-${new Date().toISOString().slice(0, 10)}.pdf`, {
      title: 'Customers', subtitle: `${shown.length} customer${shown.length === 1 ? '' : 's'}${term ? ` matching "${q.trim()}"` : ''} · paid totals count verified payments only`,
      footer: `Generated ${formatDate(new Date().toISOString(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })} (PH time)`,
      blocks: [{ type: 'table',
        columns: [{ header: 'Name', weight: 2.4 }, { header: 'Email', weight: 3 }, { header: 'Registered', weight: 1.6 }, { header: 'Orders', weight: 0.9, align: 'right' }, { header: 'Paid total', weight: 1.7, align: 'right' }, { header: 'Last order', weight: 1.6 }],
        rows: shown.map((c) => [c.full_name || '(no name)', c.email, day(c.registered_at), String(c.order_count), pdfMoney(c.total_spent_centavos), c.last_order_at ? day(c.last_order_at) : '–']),
        foot: ['Total', '', '', String(shown.reduce((t, c) => t + c.order_count, 0)), pdfMoney(shown.reduce((t, c) => t + c.total_spent_centavos, 0)), ''] }],
    })
  }

  return (
    <>
      <PageHeader eyebrow="people" title="customers">
        <button onClick={exportPdf} className="btn-ghost btn-sm" disabled={shown.length === 0}><FileText className="h-4 w-4" /> Export PDF</button>
        <button onClick={exportCsv} className="btn-ghost btn-sm" disabled={shown.length === 0}><Download className="h-4 w-4" /> Export CSV</button>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Customer summary">
        <StatCard label="Customers" value={data.length} tone="cloud" />
        <StatCard label="Have ordered" value={withOrders} hint={data.length ? `${Math.round((withOrders / data.length) * 100)}% of customers` : undefined} />
        <div className="col-span-2 lg:col-span-1"><StatCard label="Paid lifetime total" value={formatPHP(lifetime)} tone="star" /></div>
      </section>

      <div className="card mt-5 grid gap-3 p-4 sm:grid-cols-[1fr_13rem]" role="search">
        <div className="relative">
          <label htmlFor="c-q" className="sr-only">Search customers</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-milk/50" />
          <input id="c-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="input pl-10" />
        </div>
        <div><label htmlFor="c-sort" className="sr-only">Sort by</label>
          <select id="c-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input">
            <option value="new">Newest first</option><option value="spent">Top spenders</option><option value="orders">Most orders</option>
          </select></div>
      </div>

      <div className="mt-5">
        {shown.length === 0 ? <EmptyState title={data.length === 0 ? 'no customers yet' : 'no matches'}>{data.length === 0 ? 'When people create an account they’ll show up here.' : 'Try a different search.'}</EmptyState> : (
          <ul className="grid gap-3">
            {shown.map((c) => (
              <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold">{c.full_name || <span className="text-milk/50">(no name)</span>}</p>
                  <a href={`mailto:${c.email}`} className="block truncate text-sm text-milk/70 hover:text-bun-ribbon">{c.email}</a>
                  <p className="text-xs text-milk/50">Joined {formatDate(c.registered_at)}{c.last_order_at ? ` · last order ${formatDate(c.last_order_at)}` : ''}</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div><p className="font-display text-xl font-semibold">{c.order_count}</p><p className="text-xs text-milk/55">order{c.order_count === 1 ? '' : 's'}</p></div>
                  <div><p className="font-display text-xl font-semibold">{formatPHP(c.total_spent_centavos)}</p><p className="text-xs text-milk/55">paid</p></div>
                  {c.order_count > 0 && <Link to={`/admin/orders?q=${encodeURIComponent(c.email)}`} className="btn-ghost btn-sm">Orders</Link>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
