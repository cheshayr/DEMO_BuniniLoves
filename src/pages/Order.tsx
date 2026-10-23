import { useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, ExternalLink, Truck, Upload } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  METHOD_LABEL, PAYMENT_LABEL, STATUS_LABEL, TIMELINE, fetchOrder, friendlyRpcError, type OrderStatus,
} from '@/lib/orders'
import { formatDate, formatPHP } from '@/lib/format'
import { Approx } from '@/components/ui/Money'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { FormMessage } from '@/pages/auth/AuthShell'
import { Heart, Star } from '@/components/ui/Doodles'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export function statusBadge(s: OrderStatus) {
  const tone = s === 'cancelled' || s === 'refunded' ? 'badge-muted' : s === 'delivered' ? 'badge-cloud' : s === 'awaiting_payment' || s === 'payment_verification' ? 'badge-star' : 'badge-pink'
  return <span className={tone}>{STATUS_LABEL[s]}</span>
}

function Timeline({ status, history, cod }: { status: OrderStatus; history: { status: OrderStatus; created_at: string }[]; cod: boolean }) {
  const closed = status === 'cancelled' || status === 'refunded'
  const reached = new Map(history.map((h) => [h.status, h.created_at]))
  // Cash-on-delivery orders skip the payment steps. Otherwise show what happened plus what is still ahead.
  const idx = TIMELINE.indexOf(status)
  const isPaymentStep = (st: OrderStatus) => st === 'awaiting_payment' || st === 'payment_verification'
  const steps = TIMELINE.filter((st, i) => reached.has(st) || st === status || (!closed && i > idx && !(cod && isPaymentStep(st))))
  return (
    <ol className="grid gap-0" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = reached.has(s)
        const current = s === status
        return (
          <li key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`grid h-7 w-7 place-items-center rounded-full border-2 border-ink-950 ${current ? 'bg-star' : done ? 'bg-bun' : 'bg-white'}`}>{done && !current ? <Check className="h-4 w-4" /> : current ? <Star className="h-4 w-4 text-sun" /> : null}</span>
              {i < steps.length - 1 && <span className="h-6 w-0.5 bg-ink-950/25" />}
            </div>
            <div className="pb-4">
              <p className={`font-display font-semibold leading-7 ${done || current ? '' : 'text-milk/45'}`}>{STATUS_LABEL[s]}</p>
              {reached.get(s) && <p className="text-xs text-milk/60">{formatDate(reached.get(s)!, { dateStyle: 'medium', timeStyle: 'short' })}</p>}
            </div>
          </li>
        )
      })}
      {closed && <li className="rounded-2xl border-2 border-ink-950 bg-white p-3 text-sm font-semibold">This order was {status}.</li>}
    </ol>
  )
}

export default function Order() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useAsync(() => fetchOrder(id), [id, tick])
  const refresh = () => setTick((t) => t + 1)

  const fileRef = useRef<HTMLInputElement>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [proofUrl, setProofUrl] = useState<string | null>(null)

  if (loading && !data) return <section className="container-x max-w-4xl py-12"><div className="skeleton h-96" /></section>
  if (error) return <section className="container-x max-w-4xl py-12"><ErrorState message={error} onRetry={refresh} /></section>
  if (!data) return <section className="container-x max-w-xl py-12"><EmptyState title="We couldn't find that order" action={<Link to="/account/orders" className="btn-primary btn-sm">My orders</Link>}>It may belong to a different account.</EmptyState></section>

  const { order, items, history, payment } = data
  const placed = params.get('placed') === '1'
  const needsProof = order.payment_method !== 'cod' && order.payment_method !== 'card' && (order.status === 'awaiting_payment' || order.status === 'payment_verification')
  const canCancel = order.status === 'pending' || order.status === 'awaiting_payment'

  const uploadProof = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    const file = fileRef.current?.files?.[0]
    if (!file || !user) return setMsg({ ok: false, text: 'Please choose your payment screenshot first.' })
    if (!ALLOWED.includes(file.type)) return setMsg({ ok: false, text: 'Upload a JPG, PNG, WebP or PDF file.' })
    if (file.size > MAX_BYTES) return setMsg({ ok: false, text: 'That file is over 5 MB. Please choose a smaller one.' })
    setBusy(true)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)
    const path = `${user.id}/${order.id}/${Date.now()}-${safe}`
    const up = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false })
    if (up.error) { setBusy(false); return setMsg({ ok: false, text: 'Upload failed. Please try again.' }) }
    const { error: err } = await supabase.rpc('submit_payment_proof', { p_order: order.id, p_reference: reference || null, p_proof_path: path })
    setBusy(false)
    if (err) return setMsg({ ok: false, text: friendlyRpcError(err) })
    setMsg({ ok: true, text: 'Proof received! We’ll verify your payment shortly.' }); setReference(''); if (fileRef.current) fileRef.current.value = ''
    refresh()
  }

  const viewProof = async () => {
    if (!payment?.proof_path) return
    const { data: s } = await supabase.storage.from('payment-proofs').createSignedUrl(payment.proof_path, 120)
    if (s?.signedUrl) { setProofUrl(s.signedUrl); window.open(s.signedUrl, '_blank', 'noopener,noreferrer') }
  }

  const cancel = async () => {
    if (!window.confirm('Cancel this order? This can’t be undone.')) return
    setBusy(true)
    const { error: err } = await supabase.rpc('cancel_my_order', { p_order: order.id })
    setBusy(false)
    if (err) return setMsg({ ok: false, text: friendlyRpcError(err) })
    refresh()
  }

  const nextStep =
    order.status === 'cancelled' ? 'This order has been cancelled.'
    : order.status === 'awaiting_payment' ? `Send ${formatPHP(order.total_centavos)} via ${METHOD_LABEL[order.payment_method]} and upload your screenshot below. We’ll pack your order once it’s verified.`
    : order.status === 'payment_verification' ? 'We’re checking your payment. You’ll see the status change here once it’s verified.'
    : order.status === 'pending' ? 'We’ve received your order and will start preparing it soon. Please prepare the exact amount for the courier.'
    : order.status === 'processing' ? 'Your payment is confirmed and we’re getting your order ready.'
    : order.status === 'shipped' ? 'Your parcel is on its way!'
    : order.status === 'delivered' ? 'Delivered! We’d love to hear what you think. You can review your items from your account.'
    : ''

  return (
    <section className="container-x max-w-5xl py-10">
      <Link to="/account/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-milk/70 hover:text-bun-ribbon"><ChevronLeft className="h-4 w-4" /> All orders</Link>

      {placed && (
        <div className="card relative mt-4 overflow-hidden bg-star/70 p-6 text-center">
          <Heart className="absolute left-5 top-4 w-8 animate-floaty text-bun" />
          <Star className="absolute right-6 top-5 w-9 animate-twinkle text-sun" />
          <p className="eyebrow !text-ink-950/70">order placed</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">thank you! ♡</h1>
          <p className="mt-1 text-milk/80">Your order number is <strong className="font-display">{order.order_number}</strong></p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          {!placed && <p className="eyebrow">order</p>}
          <h2 className="text-3xl font-semibold">{order.order_number}</h2>
          <p className="text-sm text-milk/65">Placed {formatDate(order.created_at, { dateStyle: 'long', timeStyle: 'short' })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{statusBadge(order.status)}<span className="badge-muted">{PAYMENT_LABEL[order.payment_status]}</span></div>
      </div>

      {nextStep && <p className="mt-4 rounded-2xl border-2 border-ink-950 bg-cloud-soft p-4 text-sm font-semibold">{nextStep}</p>}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-6">
          {needsProof && (
            <form onSubmit={uploadProof} className="card grid gap-4 p-5">
              <h3 className="font-display text-xl font-semibold">{order.status === 'payment_verification' ? 'proof submitted' : 'upload payment proof'}</h3>
              {payment?.proof_path && <button type="button" onClick={viewProof} className="btn-ghost btn-sm w-fit"><ExternalLink className="h-4 w-4" /> View my uploaded proof</button>}
              {proofUrl && <span className="sr-only">Proof opened in a new tab</span>}
              {order.status === 'payment_verification' && <p className="text-sm text-milk/70">You can upload a new screenshot if you sent the wrong one.</p>}
              <div>
                <label htmlFor="ref" className="label">Reference number (optional)</label>
                <input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} className="input" placeholder="e.g. GCash ref no." />
              </div>
              <div>
                <label htmlFor="proof" className="label">Screenshot or PDF (max 5 MB)</label>
                <input id="proof" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="input file:mr-3 file:rounded-full file:border-0 file:bg-star file:px-4 file:py-1.5 file:font-display file:font-semibold" />
              </div>
              {msg && <FormMessage kind={msg.ok ? 'success' : 'error'}>{msg.text}</FormMessage>}
              <button className="btn-primary w-fit" disabled={busy}><Upload className="h-4 w-4" /> {busy ? 'Uploading…' : 'Submit proof'}</button>
              <p className="text-xs text-milk/55">Your proof is stored privately. Only you and the shop owner can see it. Your order isn’t marked paid until the shop verifies it.</p>
            </form>
          )}

          <div className="card p-5">
            <h3 className="font-display text-xl font-semibold">items</h3>
            <ul className="mt-3 divide-y-2 divide-dashed divide-ink-950/15">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="font-display font-semibold">{it.product_name}</p><p className="text-sm text-milk/65">{it.variant_name ? `${it.variant_name} · ` : ''}{formatPHP(it.unit_price_centavos)} × {it.quantity}</p></div>
                  <p className="font-display font-semibold">{formatPHP(it.unit_price_centavos * it.quantity)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid gap-1.5 border-t-2 border-ink-950 pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPHP(order.subtotal_centavos)}</dd></div>
              {order.discount_centavos > 0 && <div className="flex justify-between"><dt>Discount{order.discount_code ? ` (${order.discount_code})` : ''}</dt><dd>−{formatPHP(order.discount_centavos)}</dd></div>}
              <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shipping_centavos === 0 ? 'Free' : formatPHP(order.shipping_centavos)}</dd></div>
              <div className="flex justify-between font-display text-lg font-semibold"><dt>Total</dt><dd className="text-right">{formatPHP(order.total_centavos)}<Approx centavos={order.total_centavos} className="block !ml-0 font-sans" /></dd></div>
            </dl>
            <p className="mt-2 text-xs text-milk/55">Paid with: {METHOD_LABEL[order.payment_method]}</p>
          </div>

          <div className="card p-5">
            <h3 className="font-display text-xl font-semibold">shipping details</h3>
            <p className="mt-2 text-sm">{order.ship_name} · {order.ship_phone}<br />{order.ship_email}</p>
            <p className="mt-1 text-sm text-milk/75">{order.ship_street}, {order.ship_barangay}, {order.ship_city}, {order.ship_province}, {order.ship_region.split(' – ')[0]} {order.ship_postal_code}</p>
            {order.ship_landmark && <p className="text-sm text-milk/75">Landmark: {order.ship_landmark}</p>}
            {order.delivery_notes && <p className="text-sm text-milk/75">Notes: {order.delivery_notes}</p>}
            {(order.courier || order.tracking_number) && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-cloud-soft px-3 py-2 text-sm font-semibold"><Truck className="h-4 w-4" /> {order.courier ?? 'Courier'}{order.tracking_number ? ` · ${order.tracking_number}` : ''}</p>
            )}
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="card p-5"><h3 className="mb-4 font-display text-xl font-semibold">progress</h3><Timeline status={order.status} history={history} cod={order.payment_method === 'cod'} /></div>
          {canCancel && <button onClick={cancel} disabled={busy} className="btn-ghost text-bun-deep">Cancel this order</button>}
          {!needsProof && msg && <FormMessage kind={msg.ok ? 'success' : 'error'}>{msg.text}</FormMessage>}
          <Link to="/shop" className="btn-pink">Keep shopping</Link>
        </aside>
      </div>
    </section>
  )
}
