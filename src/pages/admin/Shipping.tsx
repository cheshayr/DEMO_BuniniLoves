import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { centavosToPesos, pesosToCentavos } from '@/lib/admin'
import { AREAS, fetchCourierSettings, newCourierId, saveCourierSettings, type Area, type Courier, type CourierSettings } from '@/lib/shipping'
import { formatPHP } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { ErrorState } from '@/components/ui/States'
import { ConfirmDialog, FieldRow, ListSkeleton, Modal, PageHeader, Toggle, useToast } from '@/components/admin/ui'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/** Add or edit one courier: name, delivery estimate and the fee for each area. */
function CourierForm({ courier, onSave, onCancel }: { courier: Courier | null; onSave: (c: Courier) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(courier?.name ?? '')
  const [estimate, setEstimate] = useState(courier?.estimate ?? '')
  const [fees, setFees] = useState<Record<Area, string>>({
    metro_manila: centavosToPesos(courier?.rates.metro_manila ?? null), luzon: centavosToPesos(courier?.rates.luzon ?? null),
    visayas: centavosToPesos(courier?.rates.visayas ?? null), mindanao: centavosToPesos(courier?.rates.mindanao ?? null),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (name.trim().length < 2) errs.name = 'Enter the courier’s name.'
    const rates = {} as Record<Area, number>
    for (const a of AREAS) {
      const v = pesosToCentavos(fees[a.id] === '' ? 'x' : fees[a.id])
      if (v === null) errs[a.id] = 'Enter an amount like 44 or 74.50.'
      else rates[a.id] = v
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await onSave({ id: courier?.id ?? newCourierId(name), name: name.trim(), available: courier?.available ?? true, estimate: estimate.trim(), rates })
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FieldRow label="Courier name" error={errors.name}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus placeholder="e.g. J&T Express" className={`input ${errors.name ? 'input-error' : ''}`} />
      </FieldRow>
      <FieldRow label="Delivery estimate (optional)" hint="Shown to customers at checkout.">
        <input value={estimate} onChange={(e) => setEstimate(e.target.value)} maxLength={60} placeholder="e.g. 2–5 business days" className="input" />
      </FieldRow>
      <fieldset className="grid gap-3">
        <legend className="label">Shipping fee per area (₱)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {AREAS.map((a) => (
            <FieldRow key={a.id} label={a.label} hint={a.hint} error={errors[a.id]}>
              <input value={fees[a.id]} onChange={(e) => setFees((f) => ({ ...f, [a.id]: e.target.value }))} inputMode="decimal" className={`input ${errors[a.id] ? 'input-error' : ''}`} />
            </FieldRow>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm" disabled={busy}>Cancel</button>
        <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : courier ? 'Save courier' : 'Add courier'}</button>
      </div>
    </form>
  )
}

export default function AdminShipping() {
  const toast = useToast()
  const { data, loading, error } = useAsync(fetchCourierSettings, [])
  const [cfg, setCfg] = useState<CourierSettings | null>(null)
  const [editing, setEditing] = useState<Courier | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Courier | null>(null)
  const [busy, setBusy] = useState(false)
  const [freeOn, setFreeOn] = useState(false)
  const [freeAmt, setFreeAmt] = useState('')

  useEffect(() => {
    if (!data) return
    setCfg(data); setFreeOn(data.free_over_centavos != null); setFreeAmt(centavosToPesos(data.free_over_centavos))
  }, [data])

  /** Saves the whole list. Shows the new state right away and puts the old one back if saving fails. */
  const commit = async (next: CourierSettings, message: string): Promise<boolean> => {
    const prev = cfg
    setCfg(next)
    try { await saveCourierSettings(next); toast(message); return true } catch (e) { setCfg(prev); toast(errMsg(e), 'error'); return false }
  }

  if (loading && !cfg) return <><PageHeader eyebrow="delivery" title="shipping" /><ListSkeleton rows={3} /></>
  if (error || !cfg) return <ErrorState message={error ?? 'Could not load shipping.'} />

  const saveCourier = async (c: Courier) => {
    const exists = cfg.couriers.some((x) => x.id === c.id)
    const next = { ...cfg, couriers: exists ? cfg.couriers.map((x) => (x.id === c.id ? c : x)) : [...cfg.couriers, c] }
    if (await commit(next, exists ? 'Courier updated' : 'Courier added')) setEditing(null)
  }
  const setAvailable = (c: Courier, available: boolean) =>
    commit({ ...cfg, couriers: cfg.couriers.map((x) => (x.id === c.id ? { ...x, available } : x)) }, available ? `${c.name} is available again` : `${c.name} is marked unavailable`)
  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    if (await commit({ ...cfg, couriers: cfg.couriers.filter((x) => x.id !== toDelete.id) }, 'Courier removed')) setToDelete(null)
    setBusy(false)
  }
  const saveFree = async () => {
    const v = freeOn ? pesosToCentavos(freeAmt) : null
    if (freeOn && (v === null || v <= 0)) return toast('Enter an amount like 1500.', 'error')
    await commit({ ...cfg, free_over_centavos: v }, freeOn ? 'Free shipping saved' : 'Free shipping is off')
  }

  const anyAvailable = cfg.couriers.some((c) => c.available)

  return (
    <>
      <PageHeader eyebrow="delivery" title="shipping">
        <button onClick={() => setEditing('new')} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Add courier</button>
      </PageHeader>

      {!anyAvailable && <p role="alert" className="mb-4 rounded-2xl border-2 border-ink-950 bg-bun/60 p-3 text-sm font-semibold">No courier is available, so customers can’t check out. Turn one on or add a courier.</p>}

      <p className="mb-4 max-w-2xl text-sm text-milk/70">Customers pick a courier at checkout. The fee they pay depends on the courier and where they live. Change a fee whenever a courier changes its rates. Turn a courier off when it’s temporarily unavailable: it shows crossed out and can’t be chosen.</p>

      {cfg.couriers.length === 0 ? (
        <div className="card p-6 text-center"><p className="font-display text-lg font-semibold">no couriers yet</p><p className="mt-1 text-sm text-milk/65">Add J&amp;T Express, LBC or any courier you use.</p></div>
      ) : (
        <ul className="grid gap-4">
          {cfg.couriers.map((c) => (
            <li key={c.id} className="card grid gap-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`flex flex-wrap items-center gap-2 font-display text-xl font-semibold ${c.available ? '' : 'text-milk/45 line-through'}`}>
                    {c.name}
                    <span className={`inline-block ${c.available ? 'badge-cloud' : 'badge-muted'}`}>{c.available ? 'Available' : 'Temporarily unavailable'}</span>
                  </p>
                  {c.estimate && <p className="text-sm text-milk/65">{c.estimate}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Toggle checked={c.available} onChange={(v) => setAvailable(c, v)} label={`${c.name} available`} />
                  <button onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink-950/10"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setToDelete(c)} aria-label={`Remove ${c.name}`} className="grid h-9 w-9 place-items-center rounded-full text-bun-ribbon hover:bg-bun-deep/15"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AREAS.map((a) => (
                  <div key={a.id} className="rounded-2xl bg-cloud-soft px-3 py-2.5">
                    <dt className="text-xs font-semibold text-milk/65">{a.label}</dt>
                    <dd className={`font-display text-lg font-semibold ${c.available ? '' : 'text-milk/45 line-through'}`}>{formatPHP(c.rates[a.id])}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}

      <section className="card mt-6 grid gap-4 p-4 sm:p-5" aria-labelledby="free-ship">
        <div>
          <h2 id="free-ship" className="font-display text-xl font-semibold">free shipping</h2>
          <p className="text-sm text-milk/65">Orders at or above this amount (after discounts) ship free with any courier.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle checked={freeOn} onChange={setFreeOn} label="Offer free shipping" />
          <span className="text-sm font-semibold">{freeOn ? 'On, for orders of ₱' : 'Off'}</span>
          {freeOn && <input value={freeAmt} onChange={(e) => setFreeAmt(e.target.value)} inputMode="decimal" aria-label="Free shipping minimum in pesos" className="input w-32" />}
          <button onClick={saveFree} className="btn-primary btn-sm ml-auto">Save</button>
        </div>
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'add courier' : 'edit courier'}>
        {editing !== null && <CourierForm key={editing === 'new' ? 'new' : editing.id} courier={editing === 'new' ? null : editing} onSave={saveCourier} onCancel={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog open={!!toDelete} busy={busy} onCancel={() => setToDelete(null)} onConfirm={remove} title="Remove this courier?" confirmLabel="Remove courier"
        message={<>“{toDelete?.name}” will no longer be offered at checkout. Past orders keep their courier. If it’s only unavailable for a while, switch it off instead so you can turn it back on later.</>} />
    </>
  )
}
