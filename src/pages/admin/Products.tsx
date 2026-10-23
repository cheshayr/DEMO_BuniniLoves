import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react'
import { ADMIN_PAGE_SIZE, deleteCategory, fetchAdminProducts, fetchAllCategories, saveCategory, slugify } from '@/lib/admin'
import type { AdminCategory, ProductStatus } from '@/lib/admin'
import { formatPHP } from '@/lib/format'
import { effectivePrice, stockState } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ConfirmDialog, FieldRow, ListSkeleton, Modal, PageHeader, Pager, Toggle, useToast } from '@/components/admin/ui'

const STATUSES: ProductStatus[] = ['published', 'draft', 'archived']
const STATUS_TEXT: Record<ProductStatus, string> = { published: 'Published', draft: 'Draft', archived: 'Archived' }
const statusTone = (s: ProductStatus) => (s === 'published' ? 'badge-cloud' : s === 'draft' ? 'badge-star' : 'badge-muted')

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/* ---------- categories manager ---------- */

function CategoriesBody({ onChanged }: { onChanged: () => void }) {
  const toast = useToast()
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useAsync(fetchAllCategories, [tick])

  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [sort, setSort] = useState('0')
  const [active, setActive] = useState(true)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [toDelete, setToDelete] = useState<AdminCategory | null>(null)

  const reset = () => { setEditing(null); setName(''); setSlug(''); setSlugTouched(false); setDescription(''); setSort('0'); setActive(true); setFormError('') }
  const edit = (c: AdminCategory) => {
    setEditing(c.id); setName(c.name); setSlug(c.slug); setSlugTouched(true); setDescription(c.description ?? ''); setSort(String(c.sort_order)); setActive(c.is_active); setFormError('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    const s = slug.trim()
    if (n.length < 2 || n.length > 60) return setFormError('Name must be 2–60 characters.')
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) return setFormError('URL name: lowercase letters, numbers and dashes only.')
    if (!/^-?\d{1,4}$/.test(sort.trim())) return setFormError('Order must be a whole number.')
    setBusy(true); setFormError('')
    try {
      await saveCategory(editing, { name: n, slug: s, description: description.trim() || null, sort_order: Number(sort), is_active: active })
      toast(editing ? 'Category updated' : 'Category added')
      reset(); setTick((t) => t + 1); onChanged()
    } catch (err) { setFormError(errMsg(err)) } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    try {
      await deleteCategory(toDelete.id)
      toast('Category deleted. Its products are now uncategorised.')
      setToDelete(null); if (editing === toDelete.id) reset()
      setTick((t) => t + 1); onChanged()
    } catch (err) { toast(errMsg(err), 'error') } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border-2 border-ink-950 bg-bun-soft/50 p-4">
        <p className="font-display font-semibold">{editing ? 'Edit category' : 'Add a category'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Name"><input value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} maxLength={60} className="input" /></FieldRow>
          <FieldRow label="URL name" hint="Used in the link, e.g. /shop/stickers"><input value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true) }} maxLength={80} className="input" /></FieldRow>
        </div>
        <FieldRow label="Description (optional)"><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="input" /></FieldRow>
        <div className="flex flex-wrap items-end gap-4">
          <FieldRow label="Sort order" hint="Lower comes first" className="w-28"><input value={sort} onChange={(e) => setSort(e.target.value)} inputMode="numeric" className="input" /></FieldRow>
          <div className="flex items-center gap-2 pb-2"><Toggle checked={active} onChange={setActive} label="Category visible in the shop" /><span className="text-sm font-semibold">Visible</span></div>
        </div>
        {formError && <p role="alert" className="field-error">{formError}</p>}
        <div className="flex gap-2">
          <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add category'}</button>
          {editing && <button type="button" onClick={reset} className="btn-ghost btn-sm">Cancel</button>}
        </div>
      </form>

      {loading && !data ? <ListSkeleton rows={3} /> : error ? <ErrorState message={error} /> : (
        <ul className="grid gap-2">
          {(data ?? []).length === 0 && <li className="text-center text-sm text-milk/60">No categories yet.</li>}
          {(data ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink-950/20 bg-white px-4 py-3">
              <div className="min-w-0"><p className="truncate font-semibold">{c.name} {!c.is_active && <span className="badge-muted ml-1">Hidden</span>}</p><p className="truncate text-xs text-milk/55">/shop/{c.slug}</p></div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => edit(c)} aria-label={`Edit ${c.name}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink-950/10"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setToDelete(c)} aria-label={`Delete ${c.name}`} className="grid h-9 w-9 place-items-center rounded-full text-bun-ribbon hover:bg-bun-deep/15"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog open={!!toDelete} busy={busy} onCancel={() => setToDelete(null)} onConfirm={remove} title="Delete this category?" confirmLabel="Delete"
        message={<>“{toDelete?.name}” will be removed. Products inside it are kept, but they’ll have no category until you assign a new one.</>} />
    </div>
  )
}

/* ---------- product list ---------- */

export default function AdminProducts() {
  const [params, setParams] = useSearchParams()
  const [catOpen, setCatOpen] = useState(false)
  const [catTick, setCatTick] = useState(0)

  const rawStatus = params.get('status')
  const status: ProductStatus | 'all' = STATUSES.includes(rawStatus as ProductStatus) ? (rawStatus as ProductStatus) : 'all'
  const category = params.get('category') ?? ''
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [qInput, setQInput] = useState(q)

  const cats = useAsync(fetchAllCategories, [catTick])
  const { data, loading, error } = useAsync(() => fetchAdminProducts({ q, status, categoryId: category || undefined, page }), [q, status, category, page])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value); else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  const hasFilters = status !== 'all' || category || q

  return (
    <>
      <PageHeader eyebrow="catalog" title="products">
        <button onClick={() => setCatOpen(true)} className="btn-ghost btn-sm"><Tags className="h-4 w-4" /> Categories</button>
        <Link to="/admin/products/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New product</Link>
      </PageHeader>

      <form onSubmit={(e) => { e.preventDefault(); setParam('q', qInput.trim()) }} role="search" className="card grid gap-3 p-4 sm:grid-cols-[1fr_11rem_13rem_auto]">
        <div className="relative">
          <label htmlFor="p-q" className="sr-only">Search products</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-milk/50" />
          <input id="p-q" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search by name or SKU" className="input pl-10" />
        </div>
        <div><label htmlFor="p-status" className="sr-only">Status</label>
          <select id="p-status" value={status} onChange={(e) => setParam('status', e.target.value)} className="input">
            <option value="all">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_TEXT[s]}</option>)}
          </select></div>
        <div><label htmlFor="p-cat" className="sr-only">Category</label>
          <select id="p-cat" value={category} onChange={(e) => setParam('category', e.target.value)} className="input">
            <option value="">All categories</option>{(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div className="flex gap-2"><button className="btn-primary btn-sm">Search</button>{hasFilters && <button type="button" className="btn-ghost btn-sm" onClick={() => { setQInput(''); setParams({}, { replace: true }) }}>Clear</button>}</div>
      </form>

      <div className="mt-5">
        {loading && !data ? <ListSkeleton rows={6} />
          : error ? <ErrorState message={error} />
          : !data?.products.length ? <EmptyState title={hasFilters ? 'no products match' : 'no products yet'} action={!hasFilters && <Link to="/admin/products/new" className="btn-primary btn-sm">Add your first product</Link>}>{hasFilters ? 'Try different filters or clear them.' : 'Add a product to start filling your shop.'}</EmptyState>
          : (
            <>
              <ul className="grid gap-3">
                {data.products.map((p) => {
                  const st = stockState(p)
                  const img = p.images[0]
                  return (
                    <li key={p.id}>
                      <Link to={`/admin/products/${p.id}`} className="card card-hover flex items-center gap-4 p-3 sm:p-4">
                        {img ? <img src={img.url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl border-2 border-ink-950 object-cover" />
                          : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border-2 border-dashed border-ink-950/40 bg-bun-soft/50 text-xs text-milk/50">no photo</div>}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-lg font-semibold">{p.name}</p>
                          <p className="truncate text-sm text-milk/65">{p.category_name ?? 'No category'}{p.sku ? ` · ${p.sku}` : ''}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className={statusTone(p.status)}>{STATUS_TEXT[p.status]}</span>
                            {st === 'out' && <span className="badge-pink">Out of stock</span>}
                            {st === 'low' && <span className="badge-star">Low · {p.total_stock} left</span>}
                            {st === 'in' && <span className="text-xs font-semibold text-milk/60">{p.total_stock} in stock</span>}
                            {p.has_variants && <span className="text-xs text-milk/50">has options</span>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-display text-lg font-semibold">{formatPHP(effectivePrice(p))}</p>
                          {p.sale_price_centavos != null && <p className="text-xs text-milk/50 line-through">{formatPHP(p.price_centavos)}</p>}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <Pager page={page} total={data.total} pageSize={ADMIN_PAGE_SIZE} onPage={(p) => setParam('page', String(p))} />
            </>
          )}
      </div>

      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="categories" wide>
        <CategoriesBody onChanged={() => setCatTick((t) => t + 1)} />
      </Modal>
    </>
  )
}
