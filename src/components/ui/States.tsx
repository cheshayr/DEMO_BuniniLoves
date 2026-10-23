import type { ReactNode } from 'react'
import { asset } from '@/lib/assets'

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card grid justify-items-center gap-2 px-6 py-14 text-center">
      <img src={asset('/art/bunny-glasses.png')} alt="" width={96} height={96} loading="lazy" className="h-24 w-24 animate-floaty" />
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {children && <p className="max-w-sm text-sm text-milk/60">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card grid justify-items-center gap-2 border-bun-deep/40 px-6 py-12 text-center">
      <h3 className="font-display text-xl font-semibold text-bun-ribbon">Couldn't load this</h3>
      <p className="max-w-sm text-sm text-milk/60">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-ghost btn-sm mt-2">Try again</button>}
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-square" />
          <div className="skeleton mt-3 h-4 w-3/4" />
          <div className="skeleton mt-2 h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}
