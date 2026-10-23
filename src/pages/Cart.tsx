import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { revalidateCart, type CartIssue } from '@/lib/checkout'
import { useCartSummary } from '@/lib/useCartSummary'
import { formatPHP } from '@/lib/format'
import { Approx } from '@/components/ui/Money'
import { EmptyState } from '@/components/ui/States'
import { DiscountBox, TotalsRows } from '@/components/cart/Summary'

export default function Cart() {
  const { lines, setQuantity, remove, replaceLines } = useCart()
  const { user, verified } = useAuth()
  const summary = useCartSummary()
  const [issues, setIssues] = useState<CartIssue[]>([])
  const [checking, setChecking] = useState(true)
  const ran = useRef(false)

  // Re-validate prices & stock against the database each time the cart page opens.
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    revalidateCart(lines)
      .then((r) => { setIssues(r.issues); if (r.issues.length || r.lines.some((l, i) => l.unitPriceCentavos !== lines[i]?.unitPriceCentavos)) replaceLines(r.lines) })
      .catch(() => undefined)
      .finally(() => setChecking(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!lines.length) {
    return (
      <section className="container-x max-w-3xl py-14">
        {issues.length > 0 && <ul className="mb-4 grid gap-2">{issues.map((i) => <li key={i.key} className="rounded-2xl border-2 border-ink-950 bg-star/60 p-3 text-sm font-semibold">{i.message}</li>)}</ul>}
        <EmptyState title="your cart is empty" action={<Link to="/shop" className="btn-primary">Start shopping</Link>}>Little things are waiting for you. Add a few favorites!</EmptyState>
      </section>
    )
  }

  return (
    <section className="container-x py-10">
      <p className="eyebrow">almost yours</p>
      <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">your cart</h1>

      {issues.length > 0 && (
        <ul role="status" className="mt-5 grid gap-2">
          {issues.map((i) => <li key={i.key} className="rounded-2xl border-2 border-ink-950 bg-star/60 p-3 text-sm font-semibold">{i.message}</li>)}
        </ul>
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
        <ul className="grid gap-4" aria-busy={checking}>
          {lines.map((l) => (
            <li key={`${l.productId}:${l.variantId ?? ''}`} className="card flex gap-4 p-3 sm:p-4">
              <Link to={`/product/${l.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-ink-950 bg-ink-700 sm:h-28 sm:w-28">
                {l.image && <img src={l.image} alt="" className="h-full w-full object-cover" loading="lazy" />}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link to={`/product/${l.slug}`} className="line-clamp-2 font-display text-base font-semibold leading-tight hover:text-bun-ribbon">{l.name}</Link>
                {l.variantName && <p className="mt-0.5 text-sm text-milk/65">{l.variantName}</p>}
                <p className="mt-1 text-sm text-milk/70">{formatPHP(l.unitPriceCentavos)} each</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="inline-flex items-center rounded-full border-2 border-ink-950 bg-white" role="group" aria-label={`Quantity for ${l.name}`}>
                    <button onClick={() => setQuantity(l.productId, l.variantId, l.quantity - 1)} aria-label="Decrease quantity" className="grid h-9 w-9 place-items-center"><Minus className="h-4 w-4" /></button>
                    <span className="w-7 text-center font-display font-semibold" aria-live="polite">{l.quantity}</span>
                    <button onClick={() => setQuantity(l.productId, l.variantId, l.quantity + 1)} disabled={l.quantity >= l.maxQuantity} aria-label="Increase quantity" className="grid h-9 w-9 place-items-center disabled:opacity-30"><Plus className="h-4 w-4" /></button>
                  </div>
                  <p className="font-display text-lg font-semibold">{formatPHP(l.unitPriceCentavos * l.quantity)}<Approx centavos={l.unitPriceCentavos * l.quantity} className="block !ml-0 font-sans" /></p>
                  <button onClick={() => remove(l.productId, l.variantId)} aria-label={`Remove ${l.name}`} className="grid h-9 w-9 place-items-center rounded-full text-milk/60 hover:bg-bun-deep/15 hover:text-bun-deep"><Trash2 className="h-4 w-4" /></button>
                </div>
                {l.quantity >= l.maxQuantity && <p className="mt-1 text-xs font-semibold text-bun-deep">That's all we have in stock.</p>}
              </div>
            </li>
          ))}
        </ul>

        <aside className="card grid gap-5 p-5 lg:sticky lg:top-24" aria-label="Order summary">
          <h2 className="font-display text-xl font-semibold">order summary</h2>
          <DiscountBox s={summary} />
          <TotalsRows s={summary} />
          {summary.couriers.free_over_centavos != null && summary.subtotal - summary.discount < summary.couriers.free_over_centavos && (
            <p className="rounded-2xl bg-cloud-soft p-3 text-xs font-semibold">Add {formatPHP(summary.couriers.free_over_centavos - (summary.subtotal - summary.discount))} more for free shipping ♡</p>
          )}
          {user && !verified && <p role="alert" className="rounded-2xl border-2 border-ink-950 bg-bun/60 p-3 text-sm font-semibold">Please verify your email before checking out. <Link to="/account" className="underline">Go to my account</Link></p>}
          <Link to="/checkout" className="btn-primary w-full" aria-disabled={checking}>{user ? 'Checkout' : 'Sign in to checkout'}</Link>
          <p className="text-center text-xs text-milk/55">Final prices and stock are confirmed again when you place your order.</p>
        </aside>
      </div>
    </section>
  )
}
