import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ShoppingBag } from 'lucide-react'
import { effectivePrice, stockState, type Product } from '@/lib/types'
import { Money } from '@/components/ui/Money'
import { useCart } from '@/context/CartContext'
import { useWishlist } from '@/context/WishlistContext'

export function ProductImage({ product, className = '' }: { product: Product; className?: string }) {
  const img = product.images[0]
  return img ? (
    <img src={img.url} alt={img.alt ?? product.name} loading="lazy" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className={`grid h-full w-full place-items-center bg-ink-700 text-xs text-milk/40 ${className}`}>no photo yet</div>
  )
}

export function ProductBadges({ product }: { product: Product }) {
  const state = stockState(product)
  return (
    <div className="flex flex-wrap gap-1.5">
      {state === 'out' && <span className="badge-muted">Sold out</span>}
      {state !== 'out' && product.sale_price_centavos != null && <span className="badge-pink">Sale</span>}
      {product.is_new_arrival && <span className="badge-star">New</span>}
      {product.is_best_seller && <span className="badge-cloud">Best seller</span>}
      {product.is_limited_edition && <span className="badge-pink">Limited</span>}
      {state === 'low' && <span className="badge-muted text-bun-ribbon">Only {product.total_stock} left</span>}
    </div>
  )
}

export function Price({ product, large = false }: { product: Product; large?: boolean }) {
  return (
    <p className={`flex items-baseline gap-2 font-display ${large ? 'text-3xl' : 'text-base'} font-semibold`}>
      <span className={product.sale_price_centavos != null ? 'text-bun-ribbon' : ''}><Money centavos={effectivePrice(product)} /></span>
      {product.sale_price_centavos != null && <s className="text-sm font-normal text-milk/40"><Money centavos={product.price_centavos} /></s>}
    </p>
  )
}

export function WishlistButton({ productId, className = '' }: { productId: string; className?: string }) {
  const { has, toggle } = useWishlist()
  const on = has(productId)
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggle(productId) }}
      aria-pressed={on}
      aria-label={on ? 'Remove from wishlist' : 'Add to wishlist'}
      className={`grid h-10 w-10 place-items-center rounded-full bg-ink-900/80 backdrop-blur transition hover:scale-110 ${className}`}
    >
      <Heart className={`h-5 w-5 transition ${on ? 'fill-bun text-bun-ribbon' : 'text-milk'}`} />
    </button>
  )
}

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart()
  const [popped, setPopped] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const out = stockState(product) === 'out'

  const quickAdd = () => {
    const added = add({
      productId: product.id, variantId: null, slug: product.slug, name: product.name, variantName: null,
      unitPriceCentavos: effectivePrice(product), image: product.images[0]?.url ?? null, maxQuantity: product.total_stock,
    })
    if (added > 0) { setPopped(true); setNote('Added to cart ♡'); setTimeout(() => setPopped(false), 400) }
    else setNote('You have all available units in your cart')
    setTimeout(() => setNote(null), 2200)
  }

  return (
    <article className="group card card-hover relative overflow-hidden p-2.5 sm:p-3">
      <Link to={`/product/${product.slug}`} className="block" aria-label={product.name}>
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-ink-700">
          <div className={`h-full w-full transition duration-500 group-hover:scale-105 ${out ? 'opacity-50 grayscale' : ''}`}><ProductImage product={product} /></div>
          <div className="absolute left-2 top-2 max-w-[75%]"><ProductBadges product={product} /></div>
        </div>
      </Link>
      <WishlistButton productId={product.id} className="absolute right-4 top-4" />
      <div className="px-1 pb-1 pt-3">
        <Link to={`/product/${product.slug}`} className="line-clamp-2 min-h-[2.5rem] font-display text-[15px] font-medium leading-tight hover:text-bun-ribbon">{product.name}</Link>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Price product={product} />
        </div>
        {product.has_variants ? (
          <Link to={`/product/${product.slug}`} className={`btn-ghost btn-sm mt-3 w-full ${out ? 'pointer-events-none opacity-50' : ''}`}>{out ? 'Sold out' : 'Choose options'}</Link>
        ) : (
          <button onClick={quickAdd} disabled={out} className={`btn-primary btn-sm mt-3 w-full ${popped ? 'animate-pop' : ''}`}>
            <ShoppingBag className="h-4 w-4" /> {out ? 'Sold out' : 'Add to cart'}
          </button>
        )}
        <p role="status" className="mt-1.5 h-4 text-center text-xs text-bun-ribbon">{note}</p>
      </div>
    </article>
  )
}
