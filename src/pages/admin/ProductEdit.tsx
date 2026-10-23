import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ExternalLink, ImagePlus, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import {
  centavosToPesos, createProduct, createVariant, deleteProduct, deleteProductImage, deleteVariant, fetchAdminProduct, fetchAllCategories,
  pesosToCentavos, saveImageOrder, slugify, updateProduct, updateVariant, uploadProductImage,
} from '@/lib/admin'
import type { AdminCategory, ProductInput, ProductRow, ProductStatus, VariantInput } from '@/lib/admin'
import { formatPHP } from '@/lib/format'
import type { ProductImage, ProductVariant } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ConfirmDialog, FieldRow, ListSkeleton, Modal, Toggle, useToast } from '@/components/admin/ui'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/* ---------- form state & validation ---------- */

interface FormState {
  name: string; slug: string; description: string; specs: string; care: string; categoryId: string; tags: string
  price: string; sale: string; sku: string; threshold: string; initialStock: string
  featured: boolean; newArrival: boolean; best: boolean; bundle: boolean; limited: boolean
  status: ProductStatus
}
type Errors = Partial<Record<keyof FormState, string>>

const fromRow = (r: ProductRow | null): FormState => ({
  name: r?.name ?? '', slug: r?.slug ?? '', description: r?.description ?? '', specs: r?.specs ?? '', care: r?.care_instructions ?? '',
  categoryId: r?.category_id ?? '', tags: (r?.tags ?? []).join(', '),
  price: centavosToPesos(r?.price_centavos), sale: centavosToPesos(r?.sale_price_centavos), sku: r?.sku ?? '',
  threshold: String(r?.low_stock_threshold ?? 5), initialStock: '0',
  featured: r?.is_featured ?? false, newArrival: r?.is_new_arrival ?? false, best: r?.is_best_seller ?? false, bundle: r?.is_bundle ?? false, limited: r?.is_limited_edition ?? false,
  status: r?.status ?? 'draft',
})

function validate(f: FormState, creating: boolean): { errors: Errors; input: ProductInput | null; initialStock: number } {
  const errors: Errors = {}
  const name = f.name.trim()
  if (name.length < 2 || name.length > 140) errors.name = 'Name must be 2–140 characters.'
  const slug = f.slug.trim()
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) errors.slug = 'Lowercase letters, numbers and dashes only, e.g. pastel-sticker-pack.'
  const price = pesosToCentavos(f.price)
  if (price === null || price <= 0) errors.price = 'Enter a price like 149 or 149.50.'
  let sale: number | null = null
  if (f.sale.trim()) {
    sale = pesosToCentavos(f.sale)
    if (sale === null) errors.sale = 'Enter a sale price like 99 or 99.50.'
    else if (price !== null && sale >= price) errors.sale = 'The sale price must be lower than the regular price.'
  }
  if (!/^\d{1,4}$/.test(f.threshold.trim())) errors.threshold = 'Enter a whole number (0 or more).'
  if (creating && !/^\d{1,6}$/.test(f.initialStock.trim())) errors.initialStock = 'Enter a whole number (0 or more).'
  const sku = f.sku.trim()
  if (sku.length > 40) errors.sku = 'SKU can be up to 40 characters.'
  if (f.description.length > 5000) errors.description = 'Description is too long (5,000 characters max).'
  if (f.specs.length > 2000) errors.specs = 'Too long (2,000 characters max).'
  if (f.care.length > 2000) errors.care = 'Too long (2,000 characters max).'
  const tags = [...new Set(f.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
  if (tags.length > 12 || tags.some((t) => t.length > 30)) errors.tags = 'Up to 12 tags, 30 characters each.'

  if (Object.keys(errors).length > 0 || price === null) return { errors, input: null, initialStock: 0 }
  return {
    errors,
    initialStock: creating ? Number(f.initialStock.trim()) : 0,
    input: {
      name, slug, description: f.description.trim(), specs: f.specs.trim() || null, care_instructions: f.care.trim() || null,
      category_id: f.categoryId || null, tags, price_centavos: price, sale_price_centavos: sale, sku: sku || null,
      low_stock_threshold: Number(f.threshold.trim()),
      is_featured: f.featured, is_new_arrival: f.newArrival, is_best_seller: f.best, is_bundle: f.bundle, is_limited_edition: f.limited,
      status: f.status,
    },
  }
}

function Money({ label, value, onChange, error, hint }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string }) {
  return (
    <FieldRow label={label} error={error} hint={hint}>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-milk/50">₱</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder="0.00" aria-invalid={Boolean(error)} className={`input pl-9 ${error ? 'input-error' : ''}`} />
      </div>
    </FieldRow>
  )
}

/* ---------- photos ---------- */

const MAX_PHOTOS = 10

function ImagesPanel({ productId, productName, images, onChanged }: { productId: string; productName: string; images: ProductImage[]; onChanged: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [toDelete, setToDelete] = useState<ProductImage | null>(null)

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    if (images.length + files.length > MAX_PHOTOS) return toast(`A product can have up to ${MAX_PHOTOS} photos.`, 'error')
    const base = images.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1
    setBusy(true)
    let ok = 0
    for (let i = 0; i < files.length; i++) {
      setProgress(`Uploading ${i + 1} of ${files.length}…`)
      try { await uploadProductImage(productId, files[i], base + ok, productName); ok++ } catch (err) { toast(`${files[i].name}: ${errMsg(err)}`, 'error') }
    }
    setBusy(false); setProgress('')
    if (ok) { toast(`${ok} photo${ok === 1 ? '' : 's'} added`); onChanged() }
  }

  const reorder = async (arr: ProductImage[]) => {
    setBusy(true)
    try { await saveImageOrder(arr); onChanged() } catch (err) { toast(errMsg(err), 'error') } finally { setBusy(false) }
  }
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= images.length) return
    const arr = [...images]
    ;[arr[index], arr[j]] = [arr[j], arr[index]]
    reorder(arr)
  }
  const makeCover = (index: number) => {
    const arr = [...images]
    const [x] = arr.splice(index, 1)
    arr.unshift(x)
    reorder(arr)
  }
  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    try { await deleteProductImage(toDelete); toast('Photo removed'); setToDelete(null); onChanged() } catch (err) { toast(errMsg(err), 'error') } finally { setBusy(false) }
  }

  return (
    <section className="card p-5" aria-label="Photos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-xl font-semibold">photos</h2><p className="text-sm text-milk/60">The first photo is the cover. JPG, PNG or WebP, up to 5 MB each.</p></div>
        <label className={`btn-primary btn-sm cursor-pointer focus-within:ring-2 focus-within:ring-ink-950 focus-within:ring-offset-2 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <ImagePlus className="h-4 w-4" /> {progress || 'Add photos'}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onPick} disabled={busy} className="sr-only" />
        </label>
      </div>

      {images.length === 0 ? <p className="mt-4 rounded-2xl border-2 border-dashed border-ink-950/30 p-6 text-center text-sm text-milk/60">No photos yet. Products with photos sell much better ♡</p> : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-2xl border-2 border-ink-950 bg-white">
              <div className="relative">
                <img src={img.url} alt={img.alt ?? ''} loading="lazy" className="aspect-square w-full object-cover" />
                {i === 0 && <span className="badge-star absolute left-2 top-2"><Star className="h-3 w-3" /> Cover</span>}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex">
                  <button onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label="Move earlier" className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink-950/10 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={busy || i === images.length - 1} aria-label="Move later" className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink-950/10 disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
                  {i > 0 && <button onClick={() => makeCover(i)} disabled={busy} aria-label="Make cover photo" title="Make cover" className="grid h-8 w-8 place-items-center rounded-full hover:bg-star/60"><Star className="h-4 w-4" /></button>}
                </div>
                <button onClick={() => setToDelete(img)} disabled={busy} aria-label="Delete photo" className="grid h-8 w-8 place-items-center rounded-full text-bun-ribbon hover:bg-bun-deep/15"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog open={!!toDelete} busy={busy} onCancel={() => setToDelete(null)} onConfirm={remove} title="Delete this photo?" confirmLabel="Delete photo"
        message="It will be removed from the product and from storage." />
    </section>
  )
}

/* ---------- options (variants) ---------- */

function VariantForm({ productId, variant, nextSort, onDone }: { productId: string; variant: ProductVariant | null; nextSort: number; onDone: (changed: boolean) => void }) {
  const toast = useToast()
  const [name, setName] = useState(variant?.name ?? '')
  const [price, setPrice] = useState(centavosToPesos(variant?.price_centavos))
  const [threshold, setThreshold] = useState(String(variant?.low_stock_threshold ?? 5))
  const [initial, setInitial] = useState('0')
  const [active, setActive] = useState(variant?.is_active ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const n = name.trim()
    if (n.length < 1 || n.length > 60) errs.name = 'Enter an option name (up to 60 characters).'
    let priceC: number | null = null
    if (price.trim()) { priceC = pesosToCentavos(price); if (priceC === null) errs.price = 'Enter a price like 149 or leave it blank.' }
    if (!/^\d{1,4}$/.test(threshold.trim())) errs.threshold = 'Whole number, 0 or more.'
    if (!variant && !/^\d{1,6}$/.test(initial.trim())) errs.initial = 'Whole number, 0 or more.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const input: VariantInput = { name: n, price_centavos: priceC, low_stock_threshold: Number(threshold), is_active: active, sort_order: variant?.sort_order ?? nextSort }
    setBusy(true)
    try {
      if (variant) await updateVariant(variant.id, input)
      else await createVariant(productId, input, Number(initial))
      toast(variant ? 'Option updated' : 'Option added')
      onDone(true)
    } catch (err) { toast(errMsg(err), 'error') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <FieldRow label="Option name" error={errors.name} hint="e.g. Pink, Pack of 3, A5"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={`input ${errors.name ? 'input-error' : ''}`} /></FieldRow>
      <Money label="Price for this option (optional)" value={price} onChange={setPrice} error={errors.price} hint="Leave blank to use the product's price." />
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Low-stock alert at" error={errors.threshold} hint="You’ll be notified at or below this many."><input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" className={`input ${errors.threshold ? 'input-error' : ''}`} /></FieldRow>
        {variant
          ? <div><p className="label">Stock now</p><p className="font-display text-2xl font-semibold">{variant.stock}</p><Link to="/admin/inventory" className="text-xs font-bold text-bun-ribbon hover:underline">Adjust in Inventory →</Link></div>
          : <FieldRow label="Opening stock" error={errors.initial}><input value={initial} onChange={(e) => setInitial(e.target.value)} inputMode="numeric" className={`input ${errors.initial ? 'input-error' : ''}`} /></FieldRow>}
      </div>
      <div className="flex items-center gap-3"><Toggle checked={active} onChange={setActive} label="Option available to customers" /><span className="text-sm font-semibold">Available to customers</span></div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onDone(false)} className="btn-ghost btn-sm" disabled={busy}>Cancel</button>
        <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : variant ? 'Save option' : 'Add option'}</button>
      </div>
    </form>
  )
}

function VariantsPanel({ productId, variants, productPrice, onChanged }: { productId: string; variants: ProductVariant[]; productPrice: number; onChanged: () => void }) {
  const toast = useToast()
  const [editing, setEditing] = useState<ProductVariant | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<ProductVariant | null>(null)
  const [busy, setBusy] = useState(false)
  const nextSort = variants.reduce((m, v) => Math.max(m, v.sort_order), -1) + 1

  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    try { await deleteVariant(toDelete.id); toast('Option deleted'); setToDelete(null); onChanged() } catch (err) { toast(errMsg(err), 'error'); setToDelete(null) } finally { setBusy(false) }
  }

  return (
    <section className="card p-5" aria-label="Options">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-xl font-semibold">options</h2><p className="text-sm text-milk/60">Colours, sizes or packs. Customers pick one, and stock is tracked per option.</p></div>
        <button onClick={() => setEditing('new')} className="btn-ghost btn-sm"><Plus className="h-4 w-4" /> Add option</button>
      </div>
      {variants.length === 0 ? <p className="mt-4 rounded-2xl border-2 border-dashed border-ink-950/30 p-5 text-center text-sm text-milk/60">No options. This product is sold as a single item. Adding the first option switches it to per-option stock.</p> : (
        <ul className="mt-4 grid gap-2">
          {variants.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-ink-950/20 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{v.name} {!v.is_active && <span className="badge-muted ml-1">Off</span>}</p>
                <p className="text-sm text-milk/65">{v.price_centavos != null ? formatPHP(v.price_centavos) : `${formatPHP(productPrice)} (same as product)`} · {v.stock} in stock</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(v)} aria-label={`Edit ${v.name}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink-950/10"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setToDelete(v)} aria-label={`Delete ${v.name}`} className="grid h-9 w-9 place-items-center rounded-full text-bun-ribbon hover:bg-bun-deep/15"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'add option' : 'edit option'}>
        {editing !== null && (
          <VariantForm key={editing === 'new' ? 'new' : editing.id} productId={productId} variant={editing === 'new' ? null : editing} nextSort={nextSort}
            onDone={(changed) => { setEditing(null); if (changed) onChanged() }} />
        )}
      </Modal>
      <ConfirmDialog open={!!toDelete} busy={busy} onCancel={() => setToDelete(null)} onConfirm={remove} title="Delete this option?" confirmLabel="Delete option"
        message={<>“{toDelete?.name}” will be removed. If it has been ordered before you’ll be asked to turn it off instead.</>} />
    </section>
  )
}

/* ---------- the form ---------- */

function ProductForm({ productId, row, categories, variants, images, onSaved }: {
  productId: string | null; row: ProductRow | null; categories: AdminCategory[]; variants: ProductVariant[]; images: ProductImage[]; onSaved: () => void
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const creating = productId === null
  const [f, setF] = useState<FormState>(() => fromRow(row))
  const [slugTouched, setSlugTouched] = useState(!creating)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))
  const err = (k: keyof FormState) => errors[k]
  const cls = (k: keyof FormState) => `input ${errors[k] ? 'input-error' : ''}`

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const res = validate(f, creating)
    setErrors(res.errors)
    if (!res.input) return toast('Please fix the highlighted fields.', 'error')
    setBusy(true)
    try {
      if (productId) { await updateProduct(productId, res.input); toast('Product saved'); onSaved() }
      else {
        const id = await createProduct(res.input, res.initialStock)
        toast('Product created. Now add photos and options.')
        navigate(`/admin/products/${id}`, { replace: true })
      }
    } catch (e2) { toast(errMsg(e2), 'error') } finally { setBusy(false) }
  }

  const doDelete = async () => {
    if (!productId) return
    setBusy(true)
    try { await deleteProduct(productId); toast('Product deleted'); navigate('/admin/products', { replace: true }) } catch (e2) { toast(errMsg(e2), 'error'); setConfirmDelete(false) } finally { setBusy(false) }
  }

  const flags: { key: 'featured' | 'newArrival' | 'best' | 'bundle' | 'limited'; label: string }[] = [
    { key: 'featured', label: 'Featured on the homepage' },
    { key: 'newArrival', label: 'New arrival' },
    { key: 'best', label: 'Best seller' },
    { key: 'bundle', label: 'Bundle' },
    { key: 'limited', label: 'Limited edition' },
  ]
  const hasVariants = variants.length > 0

  return (
    <>
      <Link to="/admin/products" className="text-sm font-semibold text-milk/70 hover:text-bun-ribbon">← All products</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{creating ? 'new' : 'edit'}</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{creating ? 'new product' : (row?.name ?? 'product')}</h1>
        </div>
        {row && row.status === 'published' && <Link to={`/product/${row.slug}`} target="_blank" className="btn-ghost btn-sm"><ExternalLink className="h-4 w-4" /> View in shop</Link>}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <aside className="grid gap-6 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24">
          <section className="card grid gap-4 p-5" aria-label="Publishing">
            <h2 className="font-display text-xl font-semibold">publishing</h2>
            <FieldRow label="Status" hint={f.status === 'published' ? 'Visible in the shop.' : f.status === 'draft' ? 'Hidden from customers.' : 'Hidden, but kept for order history.'}>
              <select value={f.status} onChange={(e) => set('status', e.target.value as ProductStatus)} className="input">
                <option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
              </select>
            </FieldRow>
            <div className="grid gap-3">
              {flags.map((fl) => (
                <div key={fl.key} className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{fl.label}</span><Toggle checked={f[fl.key]} onChange={(v) => set(fl.key, v)} label={fl.label} /></div>
              ))}
            </div>
            <button type="submit" form="product-form" className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : creating ? 'Create product' : 'Save changes'}</button>
            {!creating && <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-bold text-bun-ribbon hover:underline">Delete product…</button>}
          </section>
        </aside>

        <div className="grid gap-6 lg:col-start-1 lg:row-start-1">
          <form id="product-form" onSubmit={submit} noValidate className="grid gap-6">
            <section className="card grid gap-4 p-5" aria-label="Details">
              <h2 className="font-display text-xl font-semibold">details</h2>
              <FieldRow label="Name" error={err('name')}>
                <input value={f.name} maxLength={140} aria-invalid={Boolean(err('name'))} className={cls('name')}
                  onChange={(e) => { set('name', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)) }} />
              </FieldRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="URL name" error={err('slug')} hint={`Link: /product/${f.slug || '…'}`}>
                  <input value={f.slug} maxLength={80} className={cls('slug')} onChange={(e) => { set('slug', e.target.value.toLowerCase()); setSlugTouched(true) }} />
                </FieldRow>
                <FieldRow label="Category">
                  <select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="input">
                    <option value="">No category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (hidden)'}</option>)}
                  </select>
                </FieldRow>
              </div>
              <FieldRow label="Description" error={err('description')}><textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={5} className={`${cls('description')} min-h-28`} /></FieldRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Specs (optional)" error={err('specs')} hint="Size, material, what's inside…"><textarea value={f.specs} onChange={(e) => set('specs', e.target.value)} rows={3} className={cls('specs')} /></FieldRow>
                <FieldRow label="Care instructions (optional)" error={err('care')}><textarea value={f.care} onChange={(e) => set('care', e.target.value)} rows={3} className={cls('care')} /></FieldRow>
              </div>
              <FieldRow label="Tags" error={err('tags')} hint="Comma separated, e.g. sticker, pastel, cute"><input value={f.tags} onChange={(e) => set('tags', e.target.value)} className={cls('tags')} /></FieldRow>
            </section>

            <section className="card grid gap-4 p-5" aria-label="Pricing and stock">
              <h2 className="font-display text-xl font-semibold">pricing &amp; stock</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Money label="Price" value={f.price} onChange={(v) => set('price', v)} error={err('price')} />
                <Money label="Sale price (optional)" value={f.sale} onChange={(v) => set('sale', v)} error={err('sale')} hint="Shown with the regular price crossed out." />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FieldRow label="SKU (optional)" error={err('sku')}><input value={f.sku} onChange={(e) => set('sku', e.target.value)} maxLength={40} className={cls('sku')} /></FieldRow>
                <FieldRow label="Low-stock alert at" error={err('threshold')} hint={hasVariants ? 'Each option has its own alert level.' : 'You’ll be notified at or below this.'}>
                  <input value={f.threshold} onChange={(e) => set('threshold', e.target.value)} inputMode="numeric" disabled={hasVariants} className={cls('threshold')} />
                </FieldRow>
                {creating
                  ? <FieldRow label="Opening stock" error={err('initialStock')} hint="Recorded in the stock history."><input value={f.initialStock} onChange={(e) => set('initialStock', e.target.value)} inputMode="numeric" className={cls('initialStock')} /></FieldRow>
                  : <div><p className="label">Stock now</p><p className="font-display text-2xl font-semibold">{hasVariants ? 'per option' : row?.stock ?? 0}</p><Link to="/admin/inventory" className="text-xs font-bold text-bun-ribbon hover:underline">Adjust in Inventory →</Link></div>}
              </div>
            </section>
            <div className="lg:hidden"><button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : creating ? 'Create product' : 'Save changes'}</button></div>
          </form>

          {productId ? (
            <>
              <ImagesPanel productId={productId} productName={f.name.trim() || 'Product'} images={images} onChanged={onSaved} />
              <VariantsPanel productId={productId} variants={variants} productPrice={row?.price_centavos ?? 0} onChanged={onSaved} />
            </>
          ) : <p className="rounded-2xl border-2 border-dashed border-ink-950/30 p-5 text-center text-sm text-milk/65">Photos and options can be added right after you create the product.</p>}
        </div>
      </div>

      <ConfirmDialog open={confirmDelete} busy={busy} onCancel={() => setConfirmDelete(false)} onConfirm={doDelete} title="Delete this product?" confirmLabel="Delete product"
        message={<>This permanently removes “{row?.name}”, its photos and options. If it’s been ordered before it can’t be deleted. Archive it instead.</>} />
    </>
  )
}

/* ---------- route component ---------- */

export default function AdminProductEdit() {
  const { id } = useParams()
  const [tick, setTick] = useState(0)
  const cats = useAsync(fetchAllCategories, [])
  const prod = useAsync(async () => (id ? await fetchAdminProduct(id) : null), [id, tick])

  const back = <Link to="/admin/products" className="text-sm font-semibold text-milk/70 hover:text-bun-ribbon">← All products</Link>
  if (prod.error || cats.error) return <>{back}<div className="mt-4"><ErrorState message={prod.error ?? cats.error ?? 'Could not load.'} /></div></>
  if ((prod.loading && !prod.data) || (cats.loading && !cats.data)) return <>{back}<div className="mt-4"><ListSkeleton rows={4} /></div></>
  if (id && !prod.data) return <>{back}<div className="mt-4"><EmptyState title="product not found" action={<Link to="/admin/products" className="btn-primary btn-sm">Back to products</Link>}>It may have been deleted.</EmptyState></div></>

  return (
    <ProductForm key={id ?? 'new'} productId={id ?? null} row={prod.data?.product ?? null} categories={cats.data ?? []}
      variants={prod.data?.variants ?? []} images={prod.data?.images ?? []} onSaved={() => setTick((t) => t + 1)} />
  )
}
