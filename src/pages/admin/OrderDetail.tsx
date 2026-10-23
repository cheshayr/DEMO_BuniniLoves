import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Copy, ExternalLink, Mail, Phone, X } from 'lucide-react'
import { adminUpdateOrder, adminVerifyPayment, signedProofUrl } from '@/lib/admin'
import { formatDate, formatPHP } from '@/lib/format'
import { fetchOrder, METHOD_LABEL, STATUS_LABEL } from '@/lib/orders'
import type { HistoryRow, OrderItemRow, OrderRow, OrderStatus, PaymentRow } from '@/lib/orders'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ConfirmDialog, ListSkeleton, OrderStatusBadge, PaymentBadge, useToast } from '@/components/admin/ui'

const FLOW: OrderStatus[] = ['processing', 'packed', 'shipped', 'delivered']

/** Mirrors the rules enforced by admin_update_order() in the database (which remains the real gatekeeper). */
function allowedTargets(o: OrderRow): OrderStatus[] {
  if (o.status === 'cancelled' || o.status === 'refunded') return []
  const cod = o.payment_method === 'cod'
  const paid = o.payment_status === 'verified'
  const rank = FLOW.indexOf(o.status)
  const out: OrderStatus[] = []
  if (cod || paid) FLOW.forEach((s, i) => { if (i >= rank) out.push(s) })
  if (o.status !== 'shipped' && o.status !== 'delivered') out.push('cancelled')
  if (paid) out.push('refunded')
  return out
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

function ProofViewer({ path }: { path: string }) {
  const { data: url, loading, error } = useAsync(() => signedProofUrl(path), [path])
  const isPdf = path.toLowerCase().endsWith('.pdf')
  if (loading) return <div className="skeleton h-40" />
  if (error || !url) return <p className="text-sm font-semibold text-bun-ribbon">{error ?? 'Could not load the proof.'}</p>
  return (
    <div className="grid gap-2">
      {!isPdf && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border-2 border-ink-950 bg-white">
          <img src={url} alt="Customer's payment screenshot" className="max-h-80 w-full object-contain" />
        </a>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm w-fit"><ExternalLink className="h-4 w-4" /> {isPdf ? 'Open proof (PDF)' : 'Open full size'}</a>
      <p className="text-xs text-milk/50">This link is private and expires in a few minutes. Reload the page for a fresh one.</p>
    </div>
  )
}

function PaymentPanel({ order, payment, onChanged }: { order: OrderRow; payment: PaymentRow | null; onChanged: () => void }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const awaiting = order.status === 'payment_verification'

  const decide = async (approve: boolean) => {
    if (!approve && !note.trim()) return toast('Add a short reason so the customer knows what to fix.', 'error')
    setBusy(approve ? 'approve' : 'reject')
    try {
      await adminVerifyPayment(order.id, approve, note)
      toast(approve ? 'Payment verified. The order is now processing.' : 'Proof rejected. The customer can upload a new one.')
      setNote('')
      onChanged()
    } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(null) }
  }

  return (
    <section className="card grid gap-4 p-5" aria-label="Payment">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">payment</h2>
        <PaymentBadge status={order.payment_status} />
      </div>
      <dl className="grid gap-1 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-milk/60">Method</dt><dd className="font-semibold">{METHOD_LABEL[order.payment_method]}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-milk/60">Amount due</dt><dd className="font-semibold">{formatPHP(order.total_centavos)}</dd></div>
        {payment?.reference_number && <div className="flex justify-between gap-3"><dt className="text-milk/60">Reference no.</dt><dd className="break-all font-semibold">{payment.reference_number}</dd></div>}
      </dl>

      {order.payment_method === 'cod' && <p className="rounded-2xl bg-cloud-soft p-3 text-sm">Cash on delivery. Collect {formatPHP(order.total_centavos)} at the door. Marking the order <strong>Delivered</strong> records it as paid.</p>}
      {order.payment_method !== 'cod' && !payment?.proof_path && order.status === 'awaiting_payment' && <p className="rounded-2xl bg-star/40 p-3 text-sm">Waiting for the customer to upload their payment proof.</p>}
      {payment?.proof_path && <ProofViewer path={payment.proof_path} />}

      {awaiting && (
        <div className="grid gap-3 border-t-2 border-ink-950/10 pt-4">
          <p className="text-sm text-milk/75">Check the screenshot against your {METHOD_LABEL[order.payment_method]} records: the amount must be <strong>{formatPHP(order.total_centavos)}</strong>.</p>
          <label className="block">
            <span className="label">Note to customer (required to reject)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Amount doesn't match" className="input" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => decide(true)} disabled={busy !== null} className="btn-primary btn-sm"><Check className="h-4 w-4" /> {busy === 'approve' ? 'Verifying…' : 'Approve payment'}</button>
            <button onClick={() => decide(false)} disabled={busy !== null} className="btn-pink btn-sm"><X className="h-4 w-4" /> {busy === 'reject' ? 'Rejecting…' : 'Reject proof'}</button>
          </div>
        </div>
      )}
    </section>
  )
}

function FulfilmentPanel({ order, onChanged }: { order: OrderRow; onChanged: () => void }) {
  const toast = useToast()
  const targets = allowedTargets(order)
  const rank = FLOW.indexOf(order.status)
  const next = FLOW[rank + 1]
  const [target, setTarget] = useState<OrderStatus>(targets.includes(next) ? next : targets[0])
  const [courier, setCourier] = useState(order.courier ?? '')
  const [tracking, setTracking] = useState(order.tracking_number ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  if (targets.length === 0) return null
  const waitingPayment = order.payment_method !== 'cod' && order.payment_status !== 'verified'
  const destructive = target === 'cancelled' || target === 'refunded'

  const run = async () => {
    setBusy(true)
    try {
      await adminUpdateOrder(order.id, target, note, courier, tracking)
      toast(`Order marked ${STATUS_LABEL[target].toLowerCase()}`)
      setConfirm(false)
      setNote('')
      onChanged()
    } catch (e) { toast(errMsg(e), 'error'); setConfirm(false) } finally { setBusy(false) }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); if (destructive) setConfirm(true); else run() }

  return (
    <section className="card p-5" aria-label="Update order">
      <h2 className="font-display text-xl font-semibold">update order</h2>
      {waitingPayment && <p className="mt-3 rounded-2xl bg-star/40 p-3 text-sm">Fulfilment unlocks after the payment is verified. You can still cancel the order.</p>}
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <label className="block">
          <span className="label">Move to</span>
          <select value={target} onChange={(e) => setTarget(e.target.value as OrderStatus)} className="input">
            {targets.map((t) => <option key={t} value={t}>{STATUS_LABEL[t]}{t === order.status ? ' (current)' : ''}</option>)}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">Courier</span><input value={courier} onChange={(e) => setCourier(e.target.value)} maxLength={60} placeholder="e.g. J&T, LBC, Lalamove" className="input" /></label>
          <label className="block"><span className="label">Tracking number</span><input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={60} className="input" /></label>
        </div>
        <label className="block"><span className="label">Note (visible in the order history)</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="input" /></label>
        <button className={destructive ? 'btn-pink w-fit' : 'btn-primary w-fit'} disabled={busy}>{busy ? 'Saving…' : destructive ? `Mark as ${STATUS_LABEL[target].toLowerCase()}…` : 'Save update'}</button>
      </form>

      <ConfirmDialog open={confirm} busy={busy} onCancel={() => setConfirm(false)} onConfirm={run}
        title={target === 'cancelled' ? 'Cancel this order?' : 'Mark as refunded?'} confirmLabel={target === 'cancelled' ? 'Cancel order' : 'Mark refunded'}
        message={target === 'cancelled'
          ? <>Stock for every item goes back on the shelf and the customer sees the order as cancelled. This can’t be undone.</>
          : <>This records that you returned the money. It doesn’t move any money by itself, and it doesn’t restock items. Use Inventory to add returned items back.</>} />
    </section>
  )
}

function Items({ items, order }: { items: OrderItemRow[]; order: OrderRow }) {
  return (
    <section className="card p-5" aria-label="Items">
      <h2 className="font-display text-xl font-semibold">items</h2>
      <ul className="mt-3 divide-y divide-ink-950/10">
        {items.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0"><p className="font-semibold">{i.product_name}</p>{i.variant_name && <p className="text-sm text-milk/60">{i.variant_name}</p>}<p className="text-sm text-milk/60">{i.quantity} × {formatPHP(i.unit_price_centavos)}</p></div>
            <p className="font-display font-semibold">{formatPHP(i.quantity * i.unit_price_centavos)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-3 grid gap-1 border-t-2 border-ink-950 pt-3 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPHP(order.subtotal_centavos)}</dd></div>
        {order.discount_centavos > 0 && <div className="flex justify-between"><dt>Discount{order.discount_code ? ` (${order.discount_code})` : ''}</dt><dd>−{formatPHP(order.discount_centavos)}</dd></div>}
        <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shipping_centavos === 0 ? 'Free' : formatPHP(order.shipping_centavos)}</dd></div>
        <div className="flex justify-between font-display text-lg font-semibold"><dt>Total</dt><dd>{formatPHP(order.total_centavos)}</dd></div>
      </dl>
    </section>
  )
}

function Shipping({ order }: { order: OrderRow }) {
  const toast = useToast()
  const lines = [
    order.ship_name, order.ship_phone, order.ship_street, `Brgy. ${order.ship_barangay}`, `${order.ship_city}, ${order.ship_province}`,
    `${order.ship_region} ${order.ship_postal_code}`, order.ship_landmark ? `Landmark: ${order.ship_landmark}` : '',
  ].filter(Boolean)
  const copy = async () => {
    try { await navigator.clipboard.writeText(lines.join('\n')); toast('Address copied') } catch { toast('Couldn’t copy. Select the text instead.', 'error') }
  }
  return (
    <section className="card p-5" aria-label="Customer and shipping">
      <div className="flex items-center justify-between gap-2"><h2 className="font-display text-xl font-semibold">ship to</h2><button onClick={copy} className="btn-ghost btn-sm"><Copy className="h-4 w-4" /> Copy</button></div>
      <address className="mt-3 grid gap-0.5 text-sm not-italic">
        <p className="font-bold">{order.ship_name}</p>
        <p>{order.ship_street}</p>
        <p>Brgy. {order.ship_barangay}</p>
        <p>{order.ship_city}, {order.ship_province}</p>
        <p>{order.ship_region} {order.ship_postal_code}</p>
        {order.ship_landmark && <p className="text-milk/65">Landmark: {order.ship_landmark}</p>}
      </address>
      {order.delivery_notes && <p className="mt-3 rounded-2xl bg-cloud-soft p-3 text-sm"><strong>Delivery notes:</strong> {order.delivery_notes}</p>}
      <div className="mt-4 grid gap-2 text-sm">
        <a href={`tel:${order.ship_phone}`} className="inline-flex items-center gap-2 font-semibold hover:text-bun-ribbon"><Phone className="h-4 w-4" /> {order.ship_phone}</a>
        {order.ship_email && <a href={`mailto:${order.ship_email}`} className="inline-flex items-center gap-2 break-all font-semibold hover:text-bun-ribbon"><Mail className="h-4 w-4 shrink-0" /> {order.ship_email}</a>}
      </div>
      {(order.courier || order.tracking_number) && (
        <p className="mt-4 border-t-2 border-ink-950/10 pt-3 text-sm"><span className="text-milk/60">Courier:</span> <strong>{order.courier || '—'}</strong><br /><span className="text-milk/60">Tracking:</span> <strong className="break-all">{order.tracking_number || '—'}</strong></p>
      )}
    </section>
  )
}

function OrderHistory({ history }: { history: HistoryRow[] }) {
  return (
    <section className="card p-5" aria-label="History">
      <h2 className="font-display text-xl font-semibold">history</h2>
      <ol className="mt-3 grid gap-3">
        {[...history].reverse().map((h) => (
          <li key={h.id} className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-ink-950 bg-star" />
            <div><p className="text-sm font-bold">{STATUS_LABEL[h.status]}</p>{h.note && <p className="text-sm text-milk/70">{h.note}</p>}<p className="text-xs text-milk/50">{formatDate(h.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function AdminOrderDetail() {
  const { id = '' } = useParams()
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useAsync(() => fetchOrder(id), [id, tick])
  const reload = () => setTick((t) => t + 1)

  const back = <Link to="/admin/orders" className="text-sm font-semibold text-milk/70 hover:text-bun-ribbon">← All orders</Link>
  if (loading && !data) return <>{back}<div className="mt-4"><ListSkeleton rows={4} /></div></>
  if (error) return <>{back}<div className="mt-4"><ErrorState message={error} /></div></>
  if (!data) return <>{back}<div className="mt-4"><EmptyState title="order not found" action={<Link to="/admin/orders" className="btn-primary btn-sm">Back to orders</Link>}>It may have been removed, or the link is wrong.</EmptyState></div></>

  const { order, items, history, payment } = data
  return (
    <>
      {back}
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">order</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{order.order_number}</h1>
          <p className="mt-1 text-sm text-milk/65">{formatDate(order.created_at, { dateStyle: 'long', timeStyle: 'short' })}</p>
        </div>
        <div className="flex flex-wrap gap-2"><OrderStatusBadge status={order.status} /><PaymentBadge status={order.payment_status} /></div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-6">
          <PaymentPanel key={order.status} order={order} payment={payment} onChanged={reload} />
          <FulfilmentPanel key={`${order.status}-${order.payment_status}`} order={order} onChanged={reload} />
          <Items items={items} order={order} />
        </div>
        <div className="grid gap-6">
          <Shipping order={order} />
          <OrderHistory history={history} />
        </div>
      </div>
    </>
  )
}
