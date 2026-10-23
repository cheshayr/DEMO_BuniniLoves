import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Minus, Plus, ShoppingBag, Truck } from 'lucide-react'
import { ProductBadges, ProductCard, ProductImage, Price, WishlistButton } from '@/components/product/ProductCard'
import { Stars } from '@/components/ui/Stars'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { effectivePrice, type Product as ProductT, type ProductVariant } from '@/lib/types'
import { fetchBoughtTogether, fetchProduct, fetchRelated, reviewPhotoUrl } from '@/lib/products'
import { formatDate, formatPHP } from '@/lib/format'
import { fetchCourierSettings } from '@/lib/shipping'
import { Money } from '@/components/ui/Money'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsync } from '@/lib/useAsync'
import { useCart } from '@/context/CartContext'
import { isSupabaseConfigured } from '@/lib/supabase'

function Gallery({ product }: { product: ProductT }) {
  const [i, setI] = useState(0)
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)
  const imgs = product.images
  useEffect(() => setI(0), [product.id])
  const current = imgs[i]

  return (
    <div>
      <div
        className="relative aspect-square cursor-zoom-in overflow-hidden rounded-4xl bg-ink-700"
        onPointerMove={(e) => {
          if (e.pointerType === 'touch') return
          const r = e.currentTarget.getBoundingClientRect()
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
        }}
        onPointerLeave={() => setZoom(null)}
      >
        {current ? (
          <img
            src={current.url} alt={current.alt ?? product.name}
            className="h-full w-full object-cover transition-transform duration-150"
            style={zoom ? { transform: 'scale(2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        ) : <ProductImage product={product} />}
        <div className="pointer-events-none absolute left-3 top-3"><ProductBadges product={product} /></div>
      </div>
      {imgs.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product photos">
          {imgs.map((im, idx) => (
            <li key={im.id}>
              <button onClick={() => setI(idx)} aria-label={`Show photo ${idx + 1}`} aria-current={idx === i}
                className={`h-16 w-16 overflow-hidden rounded-2xl border-2 transition ${idx === i ? 'border-ink-950' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                <img src={im.url} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({ title, items }: { title: string; items: ProductT[] }) {
  if (!items.length) return null
  return (
    <section className="mt-16">
      <h2 className="section-title">{title}</h2>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
    </section>
  )
}

export default function Product() {
  const { slug = '' } = useParams()
  const { data, loading, error } = useAsync(() => fetchProduct(slug), [slug])
  const product = data?.product
  const related = useAsync(() => (product ? fetchRelated(product) : Promise.resolve([])), [product?.id])
  const together = useAsync(() => (product ? fetchBoughtTogether(product) : Promise.resolve([])), [product?.id])
  const [shipEstimate, setShipEstimate] = useState('2–7 business days within the Philippines')

  const { add, lines } = useCart()
  const { code: currency } = useCurrency()
  const [variantId, setVariantId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const variants: ProductVariant[] = data?.variants ?? []
  const variant = useMemo(() => variants.find((v) => v.id === variantId) ?? null, [variants, variantId])

  useEffect(() => { setVariantId(null); setQty(1); setMsg(null) }, [slug])
  useEffect(() => {
    if (!isSupabaseConfigured) return
    fetchCourierSettings().then((c) => {
      const live = c.couriers.filter((x) => x.available)
      if (!live.length) return
      const cheapest = Math.min(...live.flatMap((x) => Object.values(x.rates)))
      setShipEstimate(`via ${live.map((x) => x.name).join(' or ')}, shipping from ${formatPHP(cheapest)}`)
    }).catch(() => undefined)
  }, [])
  useEffect(() => { if (product?.name) document.title = `${product.name} — bunini loves` }, [product?.name])

  if (loading) return <section className="container-x py-12"><div className="grid gap-10 lg:grid-cols-2"><div className="skeleton aspect-square" /><div className="grid content-start gap-4"><div className="skeleton h-10 w-3/4" /><div className="skeleton h-8 w-1/4" /><div className="skeleton h-32" /></div></div></section>
  if (error) return <section className="container-x py-12"><ErrorState message={error} /></section>
  if (!product) return <section className="container-x py-12"><EmptyState title="We couldn't find that product" action={<Link to="/shop" className="btn-primary btn-sm">Back to shop</Link>}>It may have sold out for good or moved.</EmptyState></section>

  const needsVariant = product.has_variants
  const unitPrice = variant?.price_centavos ?? effectivePrice(product)
  const available = needsVariant ? (variant?.stock ?? 0) : product.total_stock
  const inCart = lines.find((l) => l.productId === product.id && l.variantId === (variant?.id ?? null))?.quantity ?? 0
  const remaining = Math.max(0, available - inCart)
  const soldOut = product.total_stock <= 0

  const addToCart = () => {
    if (needsVariant && !variant) return setMsg({ ok: false, text: 'Please choose an option first.' })
    const added = add({
      productId: product.id, variantId: variant?.id ?? null, slug: product.slug, name: product.name, variantName: variant?.name ?? null,
      unitPriceCentavos: unitPrice, image: product.images[0]?.url ?? null, maxQuantity: available,
    }, qty)
    if (added <= 0) return setMsg({ ok: false, text: `You already have all ${available} available in your cart.` })
    setMsg({ ok: true, text: added < qty ? `Added ${added}: that's all we have in stock.` : 'Added to your cart ♡' })
    setQty(1)
  }

  return (
    <article className="container-x py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-milk/55">
        <Link to="/shop" className="hover:text-bun-ribbon">Shop</Link>
        {product.category_slug && <> / <Link to={`/shop/${product.category_slug}`} className="hover:text-bun-ribbon">{product.category_name}</Link></>}
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <Gallery product={product} />

        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{product.name}</h1>
            <WishlistButton productId={product.id} className="shrink-0 border border-ink-950/10" />
          </div>
          {data?.rating && (
            <button type="button" onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })} className="mt-2 inline-flex items-center gap-2 text-sm text-milk/70 hover:text-bun-ribbon">
              <Stars value={Number(data.rating.avg_rating)} /> {data.rating.avg_rating} ({data.rating.review_count})
            </button>
          )}
          <div className="mt-4">
            {variant?.price_centavos != null ? <p className="font-display text-3xl font-semibold"><Money centavos={variant.price_centavos} /></p> : <Price product={product} large />}
            {currency !== 'PHP' && <p className="mt-1 text-xs text-milk/60">Estimated price in {currency}. You’re charged in Philippine pesos (PHP) at checkout.</p>}
          </div>
          <p className="mt-4 whitespace-pre-line text-milk/75">{product.description}</p>

          {needsVariant && (
            <fieldset className="mt-6">
              <legend className="label">Option</legend>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button key={v.id} onClick={() => { setVariantId(v.id); setQty(1); setMsg(null) }} disabled={v.stock <= 0} aria-pressed={v.id === variantId}
                    className={`rounded-full border px-4 py-2 font-display text-sm transition disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${v.id === variantId ? 'border-ink-950 bg-star text-ink-950' : 'border-ink-950/15 hover:border-ink-950'}`}>
                    {v.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <p className="mt-5 text-sm" role="status">
            {soldOut ? <span className="font-semibold text-bun-ribbon">Sold out</span>
              : needsVariant && !variant ? <span className="text-milk/60">{product.total_stock} in stock across all options</span>
              : available <= product.low_stock_threshold ? <span className="font-semibold text-bun-ribbon">Only {available} left</span>
              : <span className="text-milk/60">{available} in stock</span>}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-ink-950/15" role="group" aria-label="Quantity">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity" className="grid h-12 w-12 place-items-center disabled:opacity-30"><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center font-display font-semibold" aria-live="polite">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(Math.max(1, remaining), q + 1))} disabled={qty >= remaining} aria-label="Increase quantity" className="grid h-12 w-12 place-items-center disabled:opacity-30"><Plus className="h-4 w-4" /></button>
            </div>
            <button onClick={addToCart} disabled={soldOut || (!!variant && remaining <= 0)} className="btn-primary h-12 min-w-[12rem] flex-1">
              <ShoppingBag className="h-5 w-5" /> {soldOut ? 'Sold out' : 'Add to cart'}
            </button>
          </div>
          {msg && <p role="status" className={`mt-3 flex items-center gap-2 text-sm ${msg.ok ? 'text-bun-ribbon' : 'text-bun-ribbon'}`}>{msg.ok && <Check className="h-4 w-4" />}{msg.text}{msg.ok && <Link to="/cart" className="ml-1 underline">View cart</Link>}</p>}

          <div className="card mt-6 flex items-start gap-3 p-4 text-sm">
            <Truck className="mt-0.5 h-5 w-5 shrink-0 text-cloud" />
            <p className="text-milk/70"><strong className="text-milk">Estimated delivery:</strong> {shipEstimate}. The exact fee depends on your area and courier, and is shown at checkout.</p>
          </div>

          {(product.specs || product.care_instructions) && (
            <div className="mt-6 grid gap-4 text-sm">
              {product.specs && <div><h2 className="font-display text-base font-semibold">Specifications</h2><p className="mt-1 whitespace-pre-line text-milk/70">{product.specs}</p></div>}
              {product.care_instructions && <div><h2 className="font-display text-base font-semibold">Care</h2><p className="mt-1 whitespace-pre-line text-milk/70">{product.care_instructions}</p></div>}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            {product.category_name && <Link to={`/shop/${product.category_slug}`} className="badge-muted hover:text-bun-ribbon">{product.category_name}</Link>}
            {product.tags.map((t) => <Link key={t} to={`/shop?tag=${encodeURIComponent(t)}`} className="badge-muted hover:text-bun-ribbon">#{t}</Link>)}
          </div>
        </div>
      </div>

      <section id="reviews" className="mt-16 scroll-mt-24">
        <h2 className="section-title">reviews</h2>
        {!data?.reviews.length ? (
          <p className="mt-4 text-milk/60">No reviews yet. Customers can review items after their order is delivered.</p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {data.reviews.map((r) => {
              const photo = reviewPhotoUrl(r.photo_path)
              return (
                <li key={r.id} className="card p-5">
                  <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-milk/50">{formatDate(r.created_at)}</span></div>
                  <p className="mt-3 text-milk/85">{r.body}</p>
                  {photo && <img src={photo} alt="Customer photo" loading="lazy" className="mt-3 h-40 w-full rounded-2xl object-cover" />}
                  <p className="mt-3 flex items-center gap-2 text-sm"><span className="font-semibold">{r.reviewer_name}</span>{r.verified_purchase && <span className="badge-muted">Verified purchase</span>}</p>
                  {r.admin_reply && <div className="mt-3 rounded-2xl bg-star/50 p-3 text-sm"><p className="font-display font-semibold text-bun-ribbon">Reply from bunini loves</p><p className="mt-1 text-milk/80">{r.admin_reply}</p></div>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Row title="frequently bought together" items={together.data ?? []} />
      <Row title="you might also love" items={related.data ?? []} />
    </article>
  )
}
