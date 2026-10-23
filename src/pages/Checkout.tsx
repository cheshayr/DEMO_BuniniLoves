import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { supabase } from '@/lib/supabase'
import { fetchPaymentConfig, revalidateCart, type PaymentConfig } from '@/lib/checkout'
import { useCartSummary } from '@/lib/useCartSummary'
import { AREA_LABEL } from '@/lib/shipping'
import { METHOD_LABEL, friendlyRpcError, type PaymentMethod } from '@/lib/orders'
import { PH_REGIONS, normalizePhone } from '@/lib/ph'
import { formatPHP } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { Field } from '@/components/ui/Field'
import { DiscountBox, TotalsRows } from '@/components/cart/Summary'
import { FormMessage } from '@/pages/auth/AuthShell'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the recipient’s full name').max(100),
  phone: z.string().trim().transform(normalizePhone).refine((v) => /^09\d{9}$/.test(v), 'Use a PH mobile number like 09171234567'),
  email: z.string().trim().email('Enter a valid email'),
  region: z.string().min(1, 'Choose a region'),
  province: z.string().trim().min(2, 'Enter the province'),
  city: z.string().trim().min(2, 'Enter the city or municipality'),
  barangay: z.string().trim().min(2, 'Enter the barangay'),
  street: z.string().trim().min(3, 'Enter street, building and house number'),
  postal_code: z.string().trim().regex(/^\d{4}$/, 'Postal code is 4 digits'),
  landmark: z.string().trim().max(150).optional(),
  notes: z.string().trim().max(300).optional(),
  save: z.boolean().optional(),
})
type Form = z.infer<typeof schema>
type SavedAddress = { id: string; label: string | null; recipient_name: string; phone: string; region: string; province: string; city: string; barangay: string; street: string; postal_code: string; landmark: string | null }

const STEPS = ['Shipping', 'Review', 'Payment']
const IDEM_KEY = 'bl_idem_key'
const idemKey = () => {
  try {
    let k = sessionStorage.getItem(IDEM_KEY)
    if (!k) { k = crypto.randomUUID(); sessionStorage.setItem(IDEM_KEY, k) }
    return k
  } catch { return crypto.randomUUID() }
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mt-6 flex items-center gap-2" aria-label="Checkout progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-2" aria-current={i === step ? 'step' : undefined}>
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink-950 font-display text-sm font-semibold ${i < step ? 'bg-bun' : i === step ? 'bg-star' : 'bg-white'}`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</span>
          <span className={`hidden font-display text-sm font-medium sm:block ${i === step ? '' : 'text-milk/55'}`}>{label}</span>
          {i < STEPS.length - 1 && <span className="h-0.5 flex-1 rounded bg-ink-950/20" />}
        </li>
      ))}
    </ol>
  )
}

export default function Checkout() {
  const { user, verified } = useAuth()
  const { lines, replaceLines, clear } = useCart()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [address, setAddress] = useState<Form | null>(null)
  const [courierId, setCourierId] = useState<string | null>(null)
  const summary = useCartSummary({ region: address?.region, courierId })
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notices, setNotices] = useState<string[]>([])

  const saved = useAsync<SavedAddress[]>(async () => {
    const { data } = await supabase.from('addresses').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: false })
    return (data ?? []) as SavedAddress[]
  }, [user?.id])
  const payCfg = useAsync<PaymentConfig>(fetchPaymentConfig, [])

  const methods = useMemo(
    () => (Object.entries(payCfg.data ?? {}) as [PaymentMethod, NonNullable<PaymentConfig[PaymentMethod]>][]).filter(([m, c]) => c?.enabled && m !== 'card'),
    [payCfg.data],
  )
  useEffect(() => { if (!method && methods.length) setMethod(methods[0][0]) }, [methods, method])

  // Couriers that can be chosen for this address. Unavailable ones are shown crossed out.
  const area = summary.area
  const choices = summary.couriers.couriers
  // pick the cheapest available courier by default, and drop a choice that became unavailable
  useEffect(() => {
    if (!area || !summary.couriersLoaded) return
    const usable = choices.filter((c) => c.available)
    if (courierId && usable.some((c) => c.id === courierId)) return
    const cheapest = [...usable].sort((a, b) => a.rates[area] - b.rates[area])[0]
    setCourierId(cheapest?.id ?? null)
  }, [area, choices, courierId, summary.couriersLoaded])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: (user?.user_metadata?.full_name as string) ?? '', email: user?.email ?? '', region: '', save: false },
  })

  if (!lines.length && !placing) return <Navigate to="/cart" replace />
  if (!verified) {
    return (
      <section className="container-x max-w-xl py-14">
        <FormMessage kind="error">Please verify your email before checking out. We sent a link when you registered. You can resend it from <Link to="/account" className="underline">your account</Link>.</FormMessage>
      </section>
    )
  }

  const pickSaved = (id: string) => {
    const a = saved.data?.find((x) => x.id === id)
    if (!a) return
    reset({ name: a.recipient_name, phone: a.phone, email: user?.email ?? '', region: a.region, province: a.province, city: a.city, barangay: a.barangay, street: a.street, postal_code: a.postal_code, landmark: a.landmark ?? '', notes: '', save: false })
  }

  const toReview = async (v: Form) => {
    setAddress(v); setError(null)
    // make sure nothing changed since the cart was built
    const r = await revalidateCart(lines)
    if (r.issues.length) { replaceLines(r.lines); setNotices(r.issues.map((i) => i.message)); if (!r.lines.length) return navigate('/cart') } else setNotices([])
    setStep(1)
  }

  const placeOrder = async () => {
    if (!address || !method || !courierId) return
    setPlacing(true); setError(null)
    const r = await revalidateCart(lines)
    if (r.issues.length) { replaceLines(r.lines); setNotices(r.issues.map((i) => i.message)); setPlacing(false); setStep(1); return }

    const { data, error: err } = await supabase.rpc('place_order', {
      p_idempotency_key: idemKey(),
      p_items: lines.map((l) => ({ product_id: l.productId, variant_id: l.variantId, quantity: l.quantity })),
      p_address: { name: address.name, phone: address.phone, email: address.email, region: address.region, province: address.province, city: address.city, barangay: address.barangay, street: address.street, postal_code: address.postal_code, landmark: address.landmark || null, notes: address.notes || null },
      p_method: method,
      p_courier: courierId,
      p_discount_code: summary.code || null,
    })
    if (err || !data) { setPlacing(false); setError(friendlyRpcError(err)); return }

    if (address.save && user) {
      void supabase.from('addresses').insert({ user_id: user.id, label: 'Home', recipient_name: address.name, phone: address.phone, region: address.region, province: address.province, city: address.city, barangay: address.barangay, street: address.street, postal_code: address.postal_code, landmark: address.landmark || null })
    }
    try { sessionStorage.removeItem(IDEM_KEY) } catch { /* ignore */ }
    summary.remove(); clear()
    navigate(`/order/${data as string}?placed=1`, { replace: true })
  }

  const sel = 'input appearance-none'

  return (
    <section className="container-x py-10">
      <Link to="/cart" className="inline-flex items-center gap-1 text-sm font-semibold text-milk/70 hover:text-bun-ribbon"><ChevronLeft className="h-4 w-4" /> Back to cart</Link>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">checkout</h1>
      <Stepper step={step} />

      {notices.length > 0 && <ul role="status" className="mt-5 grid gap-2">{notices.map((n) => <li key={n} className="rounded-2xl border-2 border-ink-950 bg-star/60 p-3 text-sm font-semibold">{n}</li>)}</ul>}
      {error && <div className="mt-5"><FormMessage kind="error">{error}</FormMessage></div>}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
        <div>
          {/* STEP 1: shipping */}
          {step === 0 && (
            <form onSubmit={handleSubmit(toReview)} noValidate className="card grid gap-4 p-5 sm:p-7">
              <h2 className="font-display text-2xl font-semibold">where should we send it?</h2>
              {!!saved.data?.length && (
                <div>
                  <label htmlFor="saved" className="label">Use a saved address</label>
                  <select id="saved" defaultValue="" onChange={(e) => pickSaved(e.target.value)} className={sel}>
                    <option value="">Enter a new address</option>
                    {saved.data.map((a) => <option key={a.id} value={a.id}>{a.label ?? 'Address'}: {a.recipient_name}, {a.barangay}, {a.city}</option>)}
                  </select>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Recipient full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
                <Field label="Contact number" inputMode="tel" autoComplete="tel" placeholder="09171234567" error={errors.phone?.message} {...register('phone')} />
              </div>
              <Field label="Email address" type="email" autoComplete="email" hint="Order updates are sent here" error={errors.email?.message} {...register('email')} />
              <div>
                <label htmlFor="region" className="label">Region</label>
                <select id="region" className={`${sel} ${errors.region ? 'input-error' : ''}`} aria-invalid={Boolean(errors.region)} {...register('region')}>
                  <option value="">Select region</option>
                  {PH_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.region && <p role="alert" className="field-error">{errors.region.message}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Province" autoComplete="address-level1" error={errors.province?.message} {...register('province')} />
                <Field label="City / municipality" autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
                <Field label="Barangay" error={errors.barangay?.message} {...register('barangay')} />
                <Field label="Postal code" inputMode="numeric" maxLength={4} autoComplete="postal-code" error={errors.postal_code?.message} {...register('postal_code')} />
              </div>
              <Field label="Street, building & house number" autoComplete="address-line1" error={errors.street?.message} {...register('street')} />
              <Field label="Landmark (optional)" error={errors.landmark?.message} {...register('landmark')} />
              <Field label="Delivery instructions (optional)" error={errors.notes?.message} {...register('notes')} />
              <label className="flex cursor-pointer items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-bun-ribbon" {...register('save')} /><span className="text-sm font-semibold">Save this address for next time</span></label>
              <button className="btn-primary">Continue to review</button>
            </form>
          )}

          {/* STEP 2: review */}
          {step === 1 && address && (
            <div className="card grid gap-5 p-5 sm:p-7">
              <h2 className="font-display text-2xl font-semibold">review your order</h2>
              <ul className="grid gap-3">
                {lines.map((l) => (
                  <li key={`${l.productId}:${l.variantId ?? ''}`} className="flex items-center gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-ink-950 bg-ink-700">{l.image && <img src={l.image} alt="" className="h-full w-full object-cover" />}</div>
                    <div className="min-w-0 flex-1"><p className="truncate font-display font-semibold">{l.name}</p><p className="text-sm text-milk/65">{l.variantName ? `${l.variantName} · ` : ''}{formatPHP(l.unitPriceCentavos)} × {l.quantity}</p></div>
                    <p className="font-display font-semibold">{formatPHP(l.unitPriceCentavos * l.quantity)}</p>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl bg-cloud-soft p-4 text-sm">
                <p className="font-display font-semibold">Ship to</p>
                <p className="mt-1">{address.name} · {address.phone}</p>
                <p className="text-milk/75">{address.street}, {address.barangay}, {address.city}, {address.province}, {address.region.split(' – ')[0]} {address.postal_code}</p>
                {address.landmark && <p className="text-milk/75">Landmark: {address.landmark}</p>}
              </div>
              <fieldset className="grid gap-3">
                <legend className="font-display text-lg font-semibold">choose your courier</legend>
                {area && <p className="-mt-1 text-sm text-milk/65">Delivering to <strong>{AREA_LABEL[area]}</strong>. Each courier has its own fee for your area.</p>}
                {!summary.couriersLoaded ? <div className="skeleton h-20" /> : choices.length === 0 ? (
                  <FormMessage kind="error">No couriers are set up right now. Please contact the shop.</FormMessage>
                ) : choices.map((c) => {
                  const fee = area ? c.rates[area] : 0
                  const free = summary.couriers.free_over_centavos != null && summary.subtotal - summary.discount >= summary.couriers.free_over_centavos
                  const on = courierId === c.id && c.available
                  return (
                    <label key={c.id} className={`flex items-center gap-3 rounded-2xl border-2 p-4 transition ${!c.available ? 'cursor-not-allowed border-ink-950/15 bg-ink-950/[.03]' : on ? 'cursor-pointer border-ink-950 bg-star/50' : 'cursor-pointer border-ink-950/25 bg-white hover:border-ink-950'}`}>
                      <input type="radio" name="courier" value={c.id} checked={on} disabled={!c.available} onChange={() => setCourierId(c.id)} className="h-5 w-5 shrink-0 accent-ink-950" />
                      <span className="min-w-0 flex-1">
                        <span className={`block font-display text-lg font-semibold ${c.available ? '' : 'text-milk/45 line-through'}`}>{c.name}</span>
                        <span className="block text-sm text-milk/65">{c.available ? c.estimate : 'Temporarily unavailable'}</span>
                      </span>
                      <span className={`shrink-0 font-display text-lg font-semibold ${c.available ? '' : 'text-milk/45 line-through'}`}>{c.available && free ? 'Free' : formatPHP(fee)}</span>
                    </label>
                  )
                })}
              </fieldset>
              <DiscountBox s={summary} />
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setStep(0)} className="btn-ghost">Edit address</button>
                <button onClick={() => setStep(2)} disabled={!summary.courier} className="btn-primary flex-1">Continue to payment</button>
              </div>
            </div>
          )}

          {/* STEP 3: payment */}
          {step === 2 && (
            <div className="card grid gap-5 p-5 sm:p-7">
              <h2 className="font-display text-2xl font-semibold">how would you like to pay?</h2>
              {payCfg.loading ? <div className="skeleton h-24" /> : methods.length === 0 ? (
                <FormMessage kind="error">No payment methods are available right now. Please contact the shop.</FormMessage>
              ) : (
                <fieldset className="grid gap-3">
                  <legend className="sr-only">Payment method</legend>
                  {methods.map(([m, cfg]) => (
                    <label key={m} className={`cursor-pointer rounded-2xl border-2 p-4 transition ${method === m ? 'border-ink-950 bg-star/50' : 'border-ink-950/25 bg-white hover:border-ink-950'}`}>
                      <span className="flex items-center gap-3">
                        <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="h-5 w-5 accent-ink-950" />
                        <span className="font-display text-lg font-semibold">{METHOD_LABEL[m]}</span>
                      </span>
                      {method === m && (
                        <span className="mt-3 block text-sm">
                          {cfg.instructions && <span className="block text-milk/80">{cfg.instructions}</span>}
                          {(cfg.account_name || cfg.account_number || cfg.bank) && (
                            <span className="mt-2 block rounded-xl bg-white p-3 font-semibold">
                              {cfg.bank && <span className="block">{cfg.bank}</span>}
                              {cfg.account_name && <span className="block">{cfg.account_name}</span>}
                              {cfg.account_number && <span className="block font-display text-lg">{cfg.account_number}</span>}
                            </span>
                          )}
                          {m !== 'cod' && <span className="mt-2 block text-milk/70">After placing your order you’ll upload your payment screenshot. We verify it before packing. Your order is not marked paid until then.</span>}
                        </span>
                      )}
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setStep(1)} className="btn-ghost" disabled={placing}>Back</button>
                <button onClick={placeOrder} disabled={placing || !method || !summary.courier} className="btn-primary flex-1">{placing ? 'Placing order…' : `Place order · ${formatPHP(summary.total)}`}</button>
              </div>
            </div>
          )}
        </div>

        <aside className="card grid gap-4 p-5 lg:sticky lg:top-24" aria-label="Order total">
          <h2 className="font-display text-xl font-semibold">your total</h2>
          <TotalsRows s={summary} />
          <p className="text-xs text-milk/55">{summary.courier ? `${summary.courier.name}: estimated delivery ${summary.courier.estimate}` : 'Pick a courier to see the shipping fee and delivery estimate.'}</p>
        </aside>
      </div>
    </section>
  )
}
