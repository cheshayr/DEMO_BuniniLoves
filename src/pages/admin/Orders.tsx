import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, FileText, Search } from 'lucide-react'
import { ADMIN_PAGE_SIZE, fetchAdminOrders, fetchOrdersForExport } from '@/lib/admin'
import type { OrderFilters } from '@/lib/admin'
import { downloadCsv } from '@/lib/csv'
import { downloadPdf, pdfMoney } from '@/lib/pdf'
import { formatDate, formatPHP } from '@/lib/format'
import { METHOD_LABEL, PAYMENT_LABEL, STATUS_LABEL } from '@/lib/orders'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/orders'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ListSkeleton, OrderStatusBadge, PageHeader, PaymentBadge, Pager, useToast } from '@/components/admin/ui'

const pick = <T extends string>(v: string | null, allowed: Record<string, unknown>, extra: string[] = []): T | 'all' =>
  v && (v in allowed || extra.includes(v)) ? (v as T) : 'all'

export default function AdminOrders() {
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  const status = pick<OrderStatus | 'todo'>(params.get('status'), STATUS_LABEL, ['todo'])
  const payment = pick<PaymentStatus>(params.get('payment'), PAYMENT_LABEL)
  const method = pick<PaymentMethod>(params.get('method'), METHOD_LABEL)
  const q = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [qInput, setQInput] = useState(q)

  const filters: OrderFilters = { status, payment, method, q, from, to }
  const { data, loading, error } = useAsync(() => fetchAdminOrders({ ...filters, page }), [status, payment, method, q, from, to, page])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value); else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  const submitSearch = (e: FormEvent) => { e.preventDefault(); setParam('q', qInput.trim()) }
  const clearAll = () => { setQInput(''); setParams({}, { replace: true }) }
  const hasFilters = status !== 'all' || payment !== 'all' || method !== 'all' || q || from || to

  const runExport = async (kind: 'csv' | 'pdf') => {
    setExporting(true)
    try {
      const orders = await fetchOrdersForExport(filters)
      if (kind === 'pdf') {
        const active = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
        const verified = active.filter((o) => o.payment_status === 'verified')
        const when = (iso: string) => formatDate(iso, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
        const applied = [
          status !== 'all' && `status: ${status === 'todo' ? 'to do' : STATUS_LABEL[status]}`, payment !== 'all' && `payment: ${PAYMENT_LABEL[payment]}`,
          method !== 'all' && `method: ${METHOD_LABEL[method]}`, q && `search: "${q}"`, from && `from ${from}`, to && `to ${to}`,
        ].filter(Boolean).join(' · ')
        downloadPdf(`bunini-orders-${new Date().toISOString().slice(0, 10)}.pdf`, {
          title: 'Orders', landscape: true,
          subtitle: `${applied ? `Filters: ${applied}` : 'All orders'} · ${orders.length} order${orders.length === 1 ? '' : 's'}${orders.length === 5000 ? ' (limit reached; narrow the dates)' : ''}`,
          footer: `Generated ${when(new Date().toISOString())} (PH time)`,
          blocks: [
            { type: 'kv', items: [['Orders listed', String(orders.length)], ['Order value (excl. cancelled/refunded)', pdfMoney(active.reduce((t, o) => t + o.total_centavos, 0))], ['Verified payments', pdfMoney(verified.reduce((t, o) => t + o.total_centavos, 0))]] },
            { type: 'table',
              columns: [{ header: 'Order #', weight: 1.1 }, { header: 'Date (PH)', weight: 1.7 }, { header: 'Customer', weight: 2 }, { header: 'Items', weight: 3.4 }, { header: 'Order', weight: 1.3 }, { header: 'Payment', weight: 1.1 }, { header: 'Method', weight: 1.1 }, { header: 'Total', weight: 1.5, align: 'right' }],
              rows: orders.map((o) => [o.order_number, when(o.created_at), `${o.ship_name}\n${o.ship_phone}`,
                (o.order_items ?? []).map((i) => `${i.quantity}× ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}`).join('; '),
                STATUS_LABEL[o.status], PAYMENT_LABEL[o.payment_status], METHOD_LABEL[o.payment_method], pdfMoney(o.total_centavos)]) },
          ],
        })
        toast(`PDF ready · ${orders.length} order${orders.length === 1 ? '' : 's'}`)
        return
      }
      const header = ['Order #', 'Date (PH time)', 'Order status', 'Payment status', 'Payment method', 'Customer', 'Phone', 'Email', 'Address', 'Items',
        'Subtotal (PHP)', 'Discount (PHP)', 'Shipping (PHP)', 'Total (PHP)', 'Discount code', 'Courier', 'Tracking #']
      const rows = orders.map((o) => [
        o.order_number,
        formatDate(o.created_at, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }),
        STATUS_LABEL[o.status], PAYMENT_LABEL[o.payment_status], METHOD_LABEL[o.payment_method],
        o.ship_name, o.ship_phone, o.ship_email,
        [o.ship_street, o.ship_barangay, o.ship_city, o.ship_province, o.ship_region, o.ship_postal_code].filter(Boolean).join(', '),
        (o.order_items ?? []).map((i) => `${i.quantity}× ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}`).join('; '),
        o.subtotal_centavos / 100, o.discount_centavos / 100, o.shipping_centavos / 100, o.total_centavos / 100,
        o.discount_code, o.courier, o.tracking_number,
      ])
      downloadCsv(`bunini-orders-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
      toast(`Exported ${orders.length} order${orders.length === 1 ? '' : 's'}${orders.length === 5000 ? ' (limit reached; narrow the dates)' : ''}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="sales" title="orders">
        <button onClick={() => runExport('pdf')} disabled={exporting} className="btn-ghost btn-sm"><FileText className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export PDF'}</button>
        <button onClick={() => runExport('csv')} disabled={exporting} className="btn-ghost btn-sm"><Download className="h-4 w-4" /> Export CSV</button>
      </PageHeader>

      <form onSubmit={submitSearch} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <div className="relative sm:col-span-2">
          <label htmlFor="order-q" className="sr-only">Search orders</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-milk/50" />
          <input id="order-q" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Order #, name, email or phone" className="input pl-10" />
        </div>
        <div>
          <label htmlFor="f-status" className="sr-only">Order status</label>
          <select id="f-status" value={status} onChange={(e) => setParam('status', e.target.value)} className="input">
            <option value="all">All statuses</option>
            <option value="todo">To do (pending / processing / packed)</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-pay" className="sr-only">Payment status</label>
          <select id="f-pay" value={payment} onChange={(e) => setParam('payment', e.target.value)} className="input">
            <option value="all">Any payment</option>
            {Object.entries(PAYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-method" className="sr-only">Payment method</label>
          <select id="f-method" value={method} onChange={(e) => setParam('method', e.target.value)} className="input">
            <option value="all">Any method</option>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          <div><label htmlFor="f-from" className="sr-only">From date</label><input id="f-from" type="date" value={from} onChange={(e) => setParam('from', e.target.value)} className="input" aria-label="From date" /></div>
          <div><label htmlFor="f-to" className="sr-only">To date</label><input id="f-to" type="date" value={to} onChange={(e) => setParam('to', e.target.value)} className="input" aria-label="To date" /></div>
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <button className="btn-primary btn-sm">Search</button>
          {hasFilters && <button type="button" onClick={clearAll} className="btn-ghost btn-sm">Clear filters</button>}
          {data && <p className="ml-auto self-center text-sm text-milk/60">{data.total} order{data.total === 1 ? '' : 's'}</p>}
        </div>
      </form>

      <div className="mt-5">
        {loading ? <ListSkeleton rows={6} />
          : error ? <ErrorState message={error} />
          : !data?.rows.length ? <EmptyState title={hasFilters ? 'no orders match' : 'no orders yet'}>{hasFilters ? 'Try different filters or clear them.' : 'New orders will show up here as soon as customers check out.'}</EmptyState>
          : (
            <>
              <ul className="grid gap-3">
                {data.rows.map((o) => (
                  <li key={o.id}>
                    <Link to={`/admin/orders/${o.id}`} className="card card-hover grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="font-display text-lg font-semibold">{o.order_number} <span className="text-sm font-normal text-milk/60">· {o.ship_name}</span></p>
                        <p className="text-sm text-milk/65">{formatDate(o.created_at, { dateStyle: 'medium', timeStyle: 'short' })} · {METHOD_LABEL[o.payment_method]}</p>
                        <div className="mt-2 flex flex-wrap gap-2"><OrderStatusBadge status={o.status} /><PaymentBadge status={o.payment_status} /></div>
                      </div>
                      <p className="font-display text-xl font-semibold sm:text-right">{formatPHP(o.total_centavos)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pager page={page} total={data.total} pageSize={ADMIN_PAGE_SIZE} onPage={(p) => setParam('page', String(p))} />
            </>
          )}
      </div>
    </>
  )
}
