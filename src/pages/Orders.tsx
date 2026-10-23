import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { fetchMyOrders, PAYMENT_LABEL } from '@/lib/orders'
import { formatDate, formatPHP } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { statusBadge } from './Order'

export default function Orders() {
  const { data, loading, error } = useAsync(fetchMyOrders, [])
  return (
    <section className="container-x max-w-3xl py-12">
      <Link to="/account" className="text-sm font-semibold text-milk/70 hover:text-bun-ribbon">← My account</Link>
      <p className="eyebrow mt-3">history</p>
      <h1 className="mt-1 text-4xl font-semibold">my orders</h1>
      <div className="mt-6">
        {loading ? <div className="grid gap-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}</div>
          : error ? <ErrorState message={error} />
          : !data?.length ? <EmptyState title="no orders yet" action={<Link to="/shop" className="btn-primary btn-sm">Start shopping</Link>}>When you place an order it will show up here, along with its status.</EmptyState>
          : (
            <ul className="grid gap-3">
              {data.map((o) => (
                <li key={o.id}>
                  <Link to={`/order/${o.id}`} className="card card-hover flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-display text-lg font-semibold">{o.order_number}</p>
                      <p className="text-sm text-milk/65">{formatDate(o.created_at, { dateStyle: 'medium' })} · {PAYMENT_LABEL[o.payment_status]}</p>
                      <div className="mt-2">{statusBadge(o.status)}</div>
                    </div>
                    <div className="flex items-center gap-2"><p className="font-display text-lg font-semibold">{formatPHP(o.total_centavos)}</p><ChevronRight className="h-5 w-5" /></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </div>
    </section>
  )
}
