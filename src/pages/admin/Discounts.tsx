import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { centavosToPesos, deleteDiscount, fetchDiscounts, pesosToCentavos, saveDiscount } from '@/lib/admin'
import type { DiscountInput, DiscountRow } from '@/lib/admin'
import { formatDate, formatPHP } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ConfirmDialog, FieldRow, ListSkeleton, Modal, PageHeader, Toggle, useToast } from '@/components/admin/ui'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/** ISO timestamp -> YYYY-MM-DD in Philippine time (what the date inputs show). */
const toDateInput = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso)) : '')

type Phase = 'active' | 'off' | 'scheduled' | 'expired' | 'used-up'
function phaseOf(d: DiscountRow): Phase {
  const now = Date.now()
  if (!d.is_active) return 'off'
  if (d.max_uses != null && d.used_count >= d.max_uses) return 'used-up'
  if (d.ends_at && new Date(d.ends_at).getTime() < now) return 'expired'
  if (d.starts_at && new Date(d.starts_at).getTime() > now) return 'scheduled'
  return 'active'
}
const PHASE: Record<Phase, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'badge-cloud' }, off: { label: 'Off', cls: 'badge-muted' }, scheduled: { label: 'Scheduled', cls: 'badge-star' },
  expired: { label: 'Expired', cls: 'badge-muted' }, 'used-up': { label: 'Used up', cls: 'badge-pink' },
}

const describe = (d: DiscountRow) => {
  const parts = [d.percent_off != null ? `${d.percent_off}% off` : `${formatPHP(d.amount_off_centavos ?? 0)} off`]
  if (d.min_subtotal_centavos > 0) parts.push(`min. ${formatPHP(d.min_subtotal_centavos)}`)
  parts.push(d.max_uses != null ? `used ${d.used_count}/${d.max_uses}` : `used ${d.used_count}×`)
  if (d.starts_at) parts.push(`from ${formatDate(d.starts_at, { dateStyle: 'medium', timeZone: 'Asia/Manila' })}`)
  if (d.ends_at) parts.push(`until ${formatDate(d.ends_at, { dateStyle: 'medium', timeZone: 'Asia/Manila' })}`)
  return parts.join(' · ')
}

function DiscountForm({ discount, onDone }: { discount: DiscountRow | null; onDone: (changed: boolean) => void }) {
  const toast = useToast()
  const [code, setCode] = useState(discount?.code ?? '')
  const [kind, setKind] = useState<'percent' | 'amount'>(discount?.amount_off_centavos != null ? 'amount' : 'percent')
  const [value, setValue] = useState(discount ? (discount.percent_off != null ? String(discount.percent_off) : centavosToPesos(discount.amount_off_centavos)) : '')
  const [min, setMin] = useState(centavosToPesos(discount?.min_subtotal_centavos ?? 0))
  const [maxUses, setMaxUses] = useState(discount?.max_uses != null ? String(discount.max_uses) : '')
  const [starts, setStarts] = useState(toDateInput(discount?.starts_at ?? null))
  const [ends, setEnds] = useState(toDateInput(discount?.ends_at ?? null))
  const [active, setActive] = useState(discount?.is_active ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const c = code.trim().toUpperCase()
    if (!/^[A-Z0-9_-]{3,24}$/.test(c)) errs.code = '3–24 letters, numbers, dashes or underscores.'
    let percent: number | null = null
    let amount: number | null = null
    if (kind === 'percent') {
      if (!/^\d{1,3}$/.test(value.trim()) || Number(value) < 1 || Number(value) > 100) errs.value = 'Enter a whole percentage from 1 to 100.'
      else percent = Number(value)
    } else {
      amount = pesosToCentavos(value)
      if (amount === null || amount <= 0) errs.value = 'Enter an amount like 50 or 100.50.'
    }
    const minC = min.trim() ? pesosToCentavos(min) : 0
    if (minC === null) errs.min = 'Enter an amount like 500, or leave blank.'
    let uses: number | null = null
    if (maxUses.trim()) { if (!/^\d{1,7}$/.test(maxUses.trim()) || Number(maxUses) < 1) errs.maxUses = 'Whole number of 1 or more, or leave blank for unlimited.'; else uses = Number(maxUses) }
    if (starts && ends && ends < starts) errs.ends = 'The end date must be on or after the start date.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const input: DiscountInput = {
      code: c, percent_off: percent, amount_off_centavos: amount, min_subtotal_centavos: minC ?? 0, max_uses: uses,
      starts_at: starts ? new Date(`${starts}T00:00:00+08:00`).toISOString() : null,
      ends_at: ends ? new Date(`${ends}T23:59:59+08:00`).toISOString() : null,
      is_active: active,
    }
    setBusy(true)
    try { await saveDiscount(discount?.id ?? null, input); toast(discount ? 'Code updated' : 'Code created'); onDone(true) } catch (err) { toast(errMsg(err), 'error') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FieldRow label="Code" error={errors.code} hint="Customers type this at checkout. Not case-sensitive.">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={24} autoFocus className={`input font-mono uppercase ${errors.code ? 'input-error' : ''}`} />
      </FieldRow>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Type">
          <select value={kind} onChange={(e) => { setKind(e.target.value as 'percent' | 'amount'); setValue('') }} className="input">
            <option value="percent">Percentage off</option><option value="amount">Fixed amount off (₱)</option>
          </select>
        </FieldRow>
        <FieldRow label={kind === 'percent' ? 'Percent off' : 'Amount off (₱)'} error={errors.value}>
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className={`input ${errors.value ? 'input-error' : ''}`} />
        </FieldRow>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Minimum spend (₱, optional)" error={errors.min}><input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" className={`input ${errors.min ? 'input-error' : ''}`} /></FieldRow>
        <FieldRow label="Max uses (optional)" error={errors.maxUses} hint="Blank = unlimited"><input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" className={`input ${errors.maxUses ? 'input-error' : ''}`} /></FieldRow>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Starts (optional)"><input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} className="input" /></FieldRow>
        <FieldRow label="Ends (optional)" error={errors.ends} hint="Valid through the end of this day"><input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} className={`input ${errors.ends ? 'input-error' : ''}`} /></FieldRow>
      </div>
      <div className="flex items-center gap-3"><Toggle checked={active} onChange={setActive} label="Code is active" /><span className="text-sm font-semibold">Active</span></div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onDone(false)} className="btn-ghost btn-sm" disabled={busy}>Cancel</button>
        <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : discount ? 'Save code' : 'Create code'}</button>
      </div>
    </form>
  )
}

export default function AdminDiscounts() {
  const toast = useToast()
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useAsync(fetchDiscounts, [tick])
  const [editing, setEditing] = useState<DiscountRow | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<DiscountRow | null>(null)
  const [busy, setBusy] = useState(false)
  const reload = () => setTick((t) => t + 1)

  const toggle = async (d: DiscountRow, on: boolean) => {
    try {
      await saveDiscount(d.id, { code: d.code, percent_off: d.percent_off, amount_off_centavos: d.amount_off_centavos, min_subtotal_centavos: d.min_subtotal_centavos, max_uses: d.max_uses, starts_at: d.starts_at, ends_at: d.ends_at, is_active: on })
      toast(on ? `${d.code} is on` : `${d.code} is off`)
      reload()
    } catch (e) { toast(errMsg(e), 'error') }
  }
  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    try { await deleteDiscount(toDelete.id); toast('Code deleted'); setToDelete(null); reload() } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader eyebrow="promotions" title="discount codes">
        <button onClick={() => setEditing('new')} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New code</button>
      </PageHeader>

      {loading && !data ? <ListSkeleton rows={4} />
        : error || !data ? <ErrorState message={error ?? 'Could not load discount codes.'} />
        : data.length === 0 ? <EmptyState title="no codes yet" action={<button onClick={() => setEditing('new')} className="btn-primary btn-sm">Create your first code</button>}>Create a code like WELCOME10 to reward first-time customers.</EmptyState>
        : (
          <ul className="grid gap-3">
            {data.map((d) => {
              const ph = PHASE[phaseOf(d)]
              return (
                <li key={d.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-mono text-lg font-bold">{d.code}<span className={ph.cls}>{ph.label}</span></p>
                    <p className="text-sm text-milk/65">{describe(d)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle checked={d.is_active} onChange={(v) => toggle(d, v)} label={`${d.code} active`} />
                    <button onClick={() => setEditing(d)} aria-label={`Edit ${d.code}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink-950/10"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setToDelete(d)} aria-label={`Delete ${d.code}`} className="grid h-9 w-9 place-items-center rounded-full text-bun-ribbon hover:bg-bun-deep/15"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'new discount code' : 'edit discount code'}>
        {editing !== null && <DiscountForm key={editing === 'new' ? 'new' : editing.id} discount={editing === 'new' ? null : editing} onDone={(changed) => { setEditing(null); if (changed) reload() }} />}
      </Modal>
      <ConfirmDialog open={!!toDelete} busy={busy} onCancel={() => setToDelete(null)} onConfirm={remove} title="Delete this code?" confirmLabel="Delete code"
        message={<>“{toDelete?.code}” will stop working. Past orders that used it keep their discount. To pause a code instead, just switch it off.</>} />
    </>
  )
}
