import { Link } from 'react-router-dom'
import { fetchWishlistProducts } from '@/lib/community'
import { useAsync } from '@/lib/useAsync'
import { useWishlist } from '@/context/WishlistContext'
import { EmptyState, ErrorState, ProductGridSkeleton } from '@/components/ui/States'
import { ProductCard } from '@/components/product/ProductCard'

export default function Wishlist() {
  const { data, loading, error } = useAsync(fetchWishlistProducts, [])
  const { has } = useWishlist()
  // hearts toggle live: un-hearting an item removes it from this page right away
  const items = (data ?? []).filter((p) => has(p.id))
  return (
    <section className="container-x py-12">
      <Link to="/account" className="text-sm font-semibold text-milk/70 hover:text-bun-ribbon">← My account</Link>
      <p className="eyebrow mt-3">saved for later</p>
      <h1 className="mt-1 text-4xl font-semibold">my wishlist</h1>
      <div className="mt-8">
        {loading ? <ProductGridSkeleton count={4} />
          : error ? <ErrorState message={error} />
          : items.length === 0 ? <EmptyState title="nothing saved yet" action={<Link to="/shop" className="btn-primary btn-sm">Browse the shop</Link>}>Tap the heart on any product to keep it here.</EmptyState>
          : <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
      </div>
    </section>
  )
}
