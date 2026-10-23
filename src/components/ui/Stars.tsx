import { Star } from 'lucide-react'

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} width={size} height={size} strokeLinejoin="round" className={i <= Math.round(value) ? 'fill-star text-ink-950' : 'text-ink-950/25'} />
      ))}
    </span>
  )
}
