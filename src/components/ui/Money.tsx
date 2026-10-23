import { Globe } from 'lucide-react'
import { useCurrency } from '@/context/CurrencyContext'
import { currencyName } from '@/lib/currency'

/** A price while browsing: shown in the shopper's chosen currency (estimate) or PHP. */
export function Money({ centavos }: { centavos: number }) {
  const { browse } = useCurrency()
  return <>{browse(centavos)}</>
}

/** Small "≈ $1.72" estimate placed beside an amount that is actually charged in PHP. */
export function Approx({ centavos, className = '' }: { centavos: number; className?: string }) {
  const { approx } = useCurrency()
  const a = approx(centavos)
  return a ? <span className={`ml-1.5 whitespace-nowrap text-xs font-normal text-milk/55 ${className}`}>{a}</span> : null
}

/** Currency picker for the header. Renders nothing until the owner turns currencies on. */
export function CurrencySelect({ className = '' }: { className?: string }) {
  const { code, options, enabled, setCode } = useCurrency()
  if (!enabled) return null
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">Currency</span>
      <Globe aria-hidden="true" className="pointer-events-none absolute left-2.5 h-4 w-4 text-milk/70" />
      <select value={code} onChange={(e) => setCode(e.target.value)} title={currencyName(code)}
        className="h-10 cursor-pointer appearance-none rounded-full border-2 border-ink-950 bg-white py-0 pl-8 pr-3 font-display text-sm font-semibold text-milk outline-none transition hover:bg-star focus-visible:ring-2 focus-visible:ring-bun-ribbon">
        {options.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  )
}
