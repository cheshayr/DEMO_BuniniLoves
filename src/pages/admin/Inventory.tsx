import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Minus, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { adjustStock, ADJUST_REASONS, fetchMovements, fetchStockRows, MOVEMENT_PAGE_SIZE, REASON_LABEL, setThreshold } from '@/lib/admin'
import type { MovementReason, StockRow } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { FieldRow, ListSkeleton, Modal, PageHeader, Pager, useToast } from '@/components/admin/ui'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
type Level = 'in' | 'low' | 'out'
const levelOf = (r: StockRow): Level => (r.stock <= 0 ? 'out' : r.stock <= r.threshold ? 'low' : 'in')
const LEVEL_ORDER: Record<Level, number> = { out: 0, low: 1, in: 2 }

/* ---------- adjust dialog ---------- */

type Mode = 'add' | 'remove' | 'set'
const DEFAULT_REASON: Record<Mode, MovementReason> = { add: 'restock', remove: 'damaged', set: 'correction' }

function AdjustForm({ row, onDone }: { row: StockRow; onDone: (changed: boolean) => void }) {
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('add')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState<MovementReason>('restock')
  const [note, setNote] = useState('')
  const [threshold, setThresholdValue] = useState(String(row.threshold))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const pickMode = (m: Mode) => { setMode(m); setReason(DEFAULT_REASON[m]) }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const raw = qty.trim()
    let delta = 0
    if (raw !== '' || mode !== 'set') {
      if (!/^\d{1,6}$/.test(raw)) return setError('Enter a whole number.')
      const n = Number(raw)
      if (mode === 'add') delta = n
      else if (mode === 'remove') delta = -n
      else delta = n - row.stock
    }
    if (mode !== 'set' && delta === 0) return setError('Enter a quantity above zero.')
    if (row.stock + delta < 0) return setError(`You only have ${row.stock} in stock, so you can’t remove ${-delta}.`)
    if (!/^\d{1,4}$/.test(threshold.trim())) return setError('Alert level must be a whole number.')
    const newThreshold = Number(threshold)
    const thresholdChanged = newThreshold !== row.threshold
    if (delta === 0 && !thresholdChanged) return setError('Nothing to change.')
    if (delta !== 0 && !note.trim()) return setError('Add a short note so the history makes sense later.')

    setBusy(true)
    try {
      if (delta !== 0) await adjustStock({ productId: row.productId, variantId: row.variantId, delta, reason, note })
      if (thresholdChanged) await setThreshold(row, newThreshold)
      toast(delta !== 0 ? `Stock updated: ${row.stock + delta} now in stock` : 'Alert level updated')
      onDone(true)
    } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  const modes: { id: Mode; label: string; icon: ReactNode }[] = [
    { id: 'add', label: 'Add', icon: <Plus className="h-4 w-4" /> },
    { id: 'remove', label: 'Remove', icon: <Minus className="h-4 w-4" /> },
    { id: 'set', label: 'Set count', icon: <SlidersHorizontal className="h-4 w-4" /> },
  ]

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-sm text-milk/70">Currently <strong>{row.stock}</strong> in stock.</p>
      <div role="radiogroup" aria-label="Adjustment type" className="grid grid-cols-3 gap-2">
        {modes.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => pickMode(m.id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-ink-950 px-3 py-2 font-display text-sm font-semibold transition ${mode === m.id ? 'bg-star' : 'bg-white hover:bg-cloud-soft'}`}>
            {m.icon}{m.label}
          </button>
        ))}
      </div>
      <FieldRow label={mode === 'set' ? 'Counted quantity' : 'Quantity'} hint={mode === 'set' ? 'The actual number on your shelf. Leave blank to only change the alert level.' : undefined}>
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" autoFocus className="input" />
      </FieldRow>
      <FieldRow label="Reason">
        <select value={reason} onChange={(e) => setReason(e.target.value as MovementReason)} className="input">
          {ADJUST_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. New batch from supplier" className="input" /></FieldRow>
      <FieldRow label="Alert me when stock is at or below" hint="Low-stock notifications use this level."><input value={threshold} onChange={(e) => setThresholdValue(e.target.value)} inputMode="numeric" className="input" /></FieldRow>
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onDone(false)} className="btn-ghost btn-sm" disabled={busy}>Cancel</button>
        <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}

/* ---------- stock tab ---------- */

function StockTab() {
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useAsync(fetchStockRows, [tick])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [adjusting, setAdjusting] = useState<StockRow | null>(null)

  if (loading && !data) return <ListSkeleton rows={6} />
  if (error || !data) return <ErrorState message={error ?? 'Could not load stock.'} />

  const counts = { low: data.filter((r) => levelOf(r) === 'low').length, out: data.filter((r) => levelOf(r) === 'out').length }
  const term = q.trim().toLowerCase()
  const shown = data
    .filter((r) => (filter === 'all' || levelOf(r) === filter) && (!term || `${r.name} ${r.variantName ?? ''}`.toLowerCase().includes(term)))
    .sort((a, b) => LEVEL_ORDER[levelOf(a)] - LEVEL_ORDER[levelOf(b)] || a.name.localeCompare(b.name) || (a.variantName ?? '').localeCompare(b.variantName ?? ''))

  const chip = (id: 'all' | 'low' | 'out', label: string) => (
    <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}
      className={`rounded-full border-2 border-ink-950 px-4 py-1.5 font-display text-sm font-semibold transition ${filter === id ? 'bg-star' : 'bg-white hover:bg-cloud-soft'}`}>{label}</button>
  )

  return (
    <>
      <div className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="relative">
          <label htmlFor="inv-q" className="sr-only">Search stock</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-milk/50" />
          <input id="inv-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products or options" className="input pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">{chip('all', `All (${data.length})`)}{chip('low', `Running low (${counts.low})`)}{chip('out', `Out of stock (${counts.out})`)}</div>
      </div>

      <div className="mt-5">
        {shown.length === 0 ? <EmptyState title={data.length === 0 ? 'no products yet' : 'nothing here'}>{data.length === 0 ? 'Add products first, then manage their stock here.' : filter === 'all' ? 'No matches for your search.' : 'Nothing is in this state right now. That’s a good thing ♡'}</EmptyState> : (
          <ul className="grid gap-3">
            {shown.map((r) => {
              const lv = levelOf(r)
              return (
                <li key={r.key} className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${lv === 'out' ? 'bg-bun-soft/60' : lv === 'low' ? 'bg-star/30' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/products/${r.productId}`} className="block truncate font-display text-lg font-semibold hover:text-bun-ribbon">{r.name}</Link>
                    <p className="truncate text-sm text-milk/65">{r.variantName ?? 'Single item'}{r.status === 'draft' ? ' · Draft' : ''} · alert at {r.threshold}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {lv === 'out' && <span className="badge-pink">Out of stock</span>}
                    {lv === 'low' && <span className="badge-star">Running low</span>}
                    <p className="min-w-12 text-right font-display text-3xl font-semibold" aria-label={`${r.stock} in stock`}>{r.stock}</p>
                    <button onClick={() => setAdjusting(r)} className="btn-ghost btn-sm">Adjust</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Modal open={adjusting !== null} onClose={() => setAdjusting(null)} title="adjust stock">
        {adjusting && (
          <>
            <p className="-mt-2 mb-4 font-semibold">{adjusting.name}{adjusting.variantName ? ` — ${adjusting.variantName}` : ''}</p>
            <AdjustForm key={adjusting.key} row={adjusting} onDone={(changed) => { setAdjusting(null); if (changed) setTick((t) => t + 1) }} />
          </>
        )}
      </Modal>
    </>
  )
}

/* ---------- history tab ---------- */

function HistoryTab() {
  const [page, setPage] = useState(1)
  const { data, loading, error } = useAsync(() => fetchMovements(page), [page])
  if (loading && !data) return <ListSkeleton rows={6} />
  if (error || !data) return <ErrorState message={error ?? 'Could not load the history.'} />
  if (data.rows.length === 0) return <EmptyState title="no movements yet">Every sale, cancellation and manual change to your stock is recorded here.</EmptyState>
  return (
    <>
      <ul className="grid gap-2">
        {data.rows.map((m) => (
          <li key={m.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.products?.name ?? 'Deleted product'}{m.product_variants ? ` — ${m.product_variants.name}` : ''}</p>
              <p className="text-sm text-milk/65">{REASON_LABEL[m.reason]}{m.note ? ` · ${m.note}` : ''}</p>
              <p className="text-xs text-milk/50">{formatDate(m.created_at, { dateStyle: 'medium', timeStyle: 'short' })}{m.order_id && <> · <Link to={`/admin/orders/${m.order_id}`} className="font-bold text-bun-ribbon hover:underline">view order</Link></>}</p>
            </div>
            <div className="text-right">
              <p className={`font-display text-2xl font-semibold ${m.delta < 0 ? 'text-bun-ribbon' : ''}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</p>
              <p className="text-xs text-milk/55">now {m.stock_after}</p>
            </div>
          </li>
        ))}
      </ul>
      <Pager page={page} total={data.total} pageSize={MOVEMENT_PAGE_SIZE} onPage={setPage} />
    </>
  )
}

export default function AdminInventory() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'history' ? 'history' : 'stock'
  const tabBtn = (id: 'stock' | 'history', label: string) => (
    <button key={id} role="tab" aria-selected={tab === id} onClick={() => setParams(id === 'stock' ? {} : { tab: id }, { replace: true })}
      className={`rounded-full border-2 border-ink-950 px-5 py-2 font-display text-sm font-semibold transition ${tab === id ? 'bg-star' : 'bg-white hover:bg-cloud-soft'}`}>{label}</button>
  )
  return (
    <>
      <PageHeader eyebrow="stock" title="inventory">
        <div role="tablist" aria-label="Inventory view" className="flex gap-2">{tabBtn('stock', 'Stock levels')}{tabBtn('history', 'History')}</div>
      </PageHeader>
      {tab === 'stock' ? <StockTab /> : <HistoryTab />}
    </>
  )
}
