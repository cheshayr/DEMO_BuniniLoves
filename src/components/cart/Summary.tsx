import { useState } from 'react'
import { Tag, X } from 'lucide-react'
import { formatPHP } from '@/lib/format'
import { useCurrency } from '@/context/CurrencyContext'
import { Approx } from '@/components/ui/Money'
import type { useCartSummary } from '@/lib/useCartSummary'

type S = ReturnType<typeof useCartSummary>

export function TotalsRows({ s }: { s: Pick<S, 'subtotal' | 'discount' | 'shipping' | 'total'> & { code?: string } }) {
  const row = 'flex items-center justify-between'
  const { code } = useCurrency()
  return (
    <dl className="grid gap-2 text-sm">
      <div className={row}><dt className="text-milk/70">Subtotal</dt><dd className="font-semibold">{formatPHP(s.subtotal)}</dd></div>
      {s.discount > 0 && <div className={row}><dt className="text-milk/70">Discount{s.code ? ` (${s.code})` : ''}</dt><dd className="font-semibold text-bun-ribbon">−{formatPHP(s.discount)}</dd></div>}
      <div className={row}><dt className="text-milk/70">Shipping</dt><dd className="font-semibold">{s.shipping == null ? <span className="font-normal text-milk/60">Chosen at checkout</span> : s.shipping === 0 ? 'Free' : formatPHP(s.shipping)}</dd></div>
      <div className={`${row} mt-1 border-t-2 border-dashed border-ink-950/30 pt-3 text-lg`}><dt className="font-display font-semibold">Total</dt><dd className="text-right font-display text-2xl font-semibold">{formatPHP(s.total)}<Approx centavos={s.total} className="block !ml-0 font-sans" /></dd></div>
      {code !== 'PHP' && <p className="mt-1 rounded-2xl bg-cloud-soft p-3 text-xs font-semibold">Heads up: you’re charged in Philippine pesos (PHP). {code} amounts are estimates and your bank’s rate may differ slightly.</p>}
    </dl>
  )
}

export function DiscountBox({ s }: { s: S }) {
  const [draft, setDraft] = useState('')
  if (s.code && s.discount > 0) {
    return (
      <div className="flex items-center justify-between rounded-2xl border-2 border-ink-950 bg-star/60 px-4 py-2.5 text-sm font-semibold">
        <span className="inline-flex items-center gap-2"><Tag className="h-4 w-4" /> {s.code} applied</span>
        <button onClick={s.remove} aria-label="Remove discount code" className="grid h-7 w-7 place-items-center rounded-full hover:bg-ink-950/10"><X className="h-4 w-4" /></button>
      </div>
    )
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.apply(draft).then(() => setDraft('')) }}>
      <label htmlFor="discount" className="label">Discount code</label>
      <div className="flex gap-2">
        <input id="discount" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="ENTER CODE" autoCapitalize="characters" className="input min-w-0 uppercase" />
        <button className="btn-ghost shrink-0" disabled={s.busy || !draft.trim()}>{s.busy ? '…' : 'Apply'}</button>
      </div>
      {s.message && <p role="status" className={`mt-1.5 text-sm font-semibold ${s.message.ok ? 'text-ink-950' : 'text-bun-deep'}`}>{s.message.text}</p>}
    </form>
  )
}
