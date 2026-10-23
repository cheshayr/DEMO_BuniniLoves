import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { ProductCard } from '@/components/product/ProductCard'
import { EmptyState, ErrorState, ProductGridSkeleton } from '@/components/ui/States'
import { CATEGORY_GROUPS, PAGE_SIZE, fetchCatalog, fetchCategories, type CatalogQuery, type SortKey } from '@/lib/products'
import { useAsync } from '@/lib/useAsync'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
]
const QUICK_FILTERS = [
  { value: 'new', label: 'New arrivals' }, { value: 'sale', label: 'On sale' }, { value: 'best', label: 'Best sellers' }, { value: 'bundle', label: 'Bundles' },
] as const
const TAGS = ['bunny', 'flowers', 'pastel', 'strawberry', 'cloud', 'bundle']

const num = (v: string | null) => (v && !Number.isNaN(Number(v)) && Number(v) >= 0 ? Number(v) : undefined)

export default function Shop() {
  const { category } = useParams()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const cats = useAsync(fetchCategories, [])

  const q = params.get('q') ?? ''
  const sort = (params.get('sort') as SortKey) || 'newest'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const min = params.get('min'); const max = params.get('max')
  const inStock = params.get('stock') === '1'
  const tag = params.get('tag') ?? ''
  const filter = (params.get('filter') as CatalogQuery['filter']) || undefined

  // Route category can be a real slug or a virtual group (e.g. "stationery")
  const group = category ? CATEGORY_GROUPS[category] : undefined
  const categorySlugs = category ? (group ? group.slugs : [category]) : undefined
  const heading = group?.name ?? cats.data?.find((c) => c.slug === category)?.name ?? (filter === 'new' ? 'New arrivals' : q ? `Results for “${q}”` : 'Shop all')

  const query = useMemo<CatalogQuery>(() => ({
    q, sort, page, categorySlugs, minPrice: num(min), maxPrice: num(max), inStockOnly: inStock, tag: tag || undefined, filter,
  }), [q, sort, page, category, min, max, inStock, tag, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, error } = useAsync(() => fetchCatalog(query), [JSON.stringify(query)])

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v == null || v === '' ? next.delete(k) : next.set(k, v)))
    if (!('page' in patch)) next.delete('page')   // any filter change returns to page 1
    setParams(next, { replace: true })
  }

  // local debounce for the search box and price inputs
  const [qDraft, setQDraft] = useState(q)
  useEffect(() => setQDraft(q), [q])
  useEffect(() => {
    if (qDraft === q) return
    const t = setTimeout(() => set({ q: qDraft.trim() || null }), 350)
    return () => clearTimeout(t)
  }, [qDraft]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))
  const activeCount = [min, max, inStock && '1', tag, filter, q].filter(Boolean).length
  const reset = () => setParams(new URLSearchParams(), { replace: true })

  const chip = (active: boolean) => `rounded-full border px-3.5 py-1.5 font-display text-sm transition ${active ? 'border-ink-950 bg-star text-ink-950' : 'border-ink-950/15 text-milk/80 hover:border-ink-950'}`

  const panel = (
    <div className="grid gap-6">
      <div>
        <p className="label">Category</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/shop" className={chip(!category)}>All</Link>
          {cats.data?.map((c) => <Link key={c.id} to={`/shop/${c.slug}`} className={chip(category === c.slug)}>{c.name.split(' & ')[0]}</Link>)}
        </div>
      </div>
      <div>
        <p className="label">Quick filters</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((f) => <button key={f.value} onClick={() => set({ filter: filter === f.value ? null : f.value })} className={chip(filter === f.value)} aria-pressed={filter === f.value}>{f.label}</button>)}
        </div>
      </div>
      <div>
        <p className="label">Price (₱)</p>
        <div className="flex items-center gap-2">
          <input aria-label="Minimum price" inputMode="numeric" placeholder="Min" defaultValue={min ?? ''} key={`min-${min}`} onBlur={(e) => set({ min: e.target.value || null })} className="input" />
          <span className="text-milk/40">–</span>
          <input aria-label="Maximum price" inputMode="numeric" placeholder="Max" defaultValue={max ?? ''} key={`max-${max}`} onBlur={(e) => set({ max: e.target.value || null })} className="input" />
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={inStock} onChange={(e) => set({ stock: e.target.checked ? '1' : null })} className="h-5 w-5 accent-star" />
        <span className="text-sm font-semibold text-milk/85">In stock only</span>
      </label>
      <div>
        <p className="label">Tags</p>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => <button key={t} onClick={() => set({ tag: tag === t ? null : t })} className={chip(tag === t)} aria-pressed={tag === t}>#{t}</button>)}
        </div>
      </div>
      {activeCount > 0 && <button onClick={reset} className="btn-ghost btn-sm w-fit"><X className="h-4 w-4" /> Clear all</button>}
    </div>
  )

  return (
    <section className="container-x py-10">
      <p className="eyebrow">shop</p>
      <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">{heading}</h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <label htmlFor="shop-q" className="sr-only">Search products</label>
          <input id="shop-q" type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Search by name or description…" className="input" />
        </div>
        <label className="sr-only" htmlFor="sort">Sort by</label>
        <select id="sort" value={sort} onChange={(e) => set({ sort: e.target.value === 'newest' ? null : e.target.value })} className="input w-auto pr-8">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} className="btn-ghost lg:hidden">
          <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className={`${filtersOpen ? 'block' : 'hidden'} card h-fit p-5 lg:block`} aria-label="Filters">{panel}</aside>

        <div>
          {!loading && data && <p className="mb-4 text-sm text-milk/55" role="status">{data.total} {data.total === 1 ? 'item' : 'items'}</p>}
          {loading ? <ProductGridSkeleton count={8} /> : error ? (
            <ErrorState message={error} onRetry={() => setParams(new URLSearchParams(params), { replace: true })} />
          ) : !data?.products.length ? (
            <EmptyState title="Nothing matches yet" action={activeCount ? <button onClick={reset} className="btn-primary btn-sm">Clear filters</button> : undefined}>
              Try a different word, widen the price range, or browse everything. New arrivals land often!
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">{data.products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
              {totalPages > 1 && (
                <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
                  <button disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} className="btn-ghost btn-sm" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="font-display text-sm text-milk/70">Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => set({ page: String(page + 1) })} className="btn-ghost btn-sm" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}