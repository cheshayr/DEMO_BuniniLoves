import { Link } from 'react-router-dom'
import { Heart } from './Doodles'

/**
 * Wordmark. To use the real Bunini Loves logo later, drop the file at
 * /public/logo.svg (or .png) and set LOGO_SRC below. Nothing else needs changing.
 */
const LOGO_SRC: string | null = null

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" aria-label="bunini loves — home" className={`group inline-flex items-center gap-2 ${className}`}>
      {LOGO_SRC ? (
        <img src={LOGO_SRC} alt="bunini loves" className="h-9 w-auto" />
      ) : (
        <>
          <span className="font-display text-2xl font-semibold lowercase tracking-tight text-milk">
            bunini <span className="text-bun-ribbon">loves</span>
          </span>
          <Heart className="h-5 w-5 text-gold transition-transform duration-300 group-hover:rotate-12 group-hover:scale-125" />
        </>
      )}
    </Link>
  )
}
