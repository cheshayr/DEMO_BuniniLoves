import type { SVGProps } from 'react'

const INK = '#2b1a2e'

/** Hand-drawn, slightly wonky star (like the stars on the Bunini Loves posters): chunky, rounded and not perfectly symmetric. */
export function Star({ className = '', ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" {...p}>
      <path
        d="M22.500 4.200 Q25.500 1.600 27.700 5.600 L31.600 14.400 Q32.800 16.700 35.400 16.900 L43.600 17.800 Q47.300 18.600 44.700 21.800 L38.200 28.600 Q36.100 30.700 36.900 33.600 L39.600 41.500 Q40.600 45.300 36.900 43.600 L29.300 38.100 Q26.900 36.600 24.200 38.300 L15.800 44.100 Q12.100 46.100 12.800 42.100 L15.100 33.800 Q15.700 31.100 13.700 29.200 L5.900 23.300 Q2.600 20.500 6.700 19.500 L15.800 17.300 Q18.500 16.600 19.600 14 Z"
        fill="currentColor" stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"
      />
    </svg>
  )
}

export function Heart({ className = '', ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" {...p}>
      <path
        d="M24 41C10 32 5 25 5 18.500 5 13 9 9 14 9c4 0 8 2.500 10 6.500C26 11.500 30 9 34 9c5 0 9 4 9 9.500C43 25 38 32 24 41z"
        fill="currentColor" stroke={INK} strokeWidth="3" strokeLinejoin="round"
      />
    </svg>
  )
}

export function Cloud({ className = '', ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 80 52" className={className} aria-hidden="true" {...p}>
      <path
        d="M20 46c-9 0-16-5-16-12 0-6 5-10 11-10 1-8 8-14 17-14 8 0 14 4 17 10 8-1 15 4 15 11 0 8-6 15-14 15z"
        fill="currentColor" stroke={INK} strokeWidth="3" strokeLinejoin="round"
      />
    </svg>
  )
}

export function Ribbon({ className = '', ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 200 60" className={className} aria-hidden="true" {...p}>
      <path d="M4 40C40 -10 80 70 120 25S180 5 196 20" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
    </svg>
  )
}

/** Scattered sparkles used as subtle backdrop decoration. */
export function Sparkles({ className = '' }: { className?: string }) {
  const spots = [
    ['8%', '12%', 'w-6', '0s'], ['90%', '16%', 'w-8', '.8s'], ['70%', '74%', 'w-5', '1.4s'],
    ['14%', '80%', 'w-7', '2s'], ['48%', '5%', 'w-5', '2.6s'], ['94%', '58%', 'w-5', '1.1s'],
  ] as const
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {spots.map(([l, t, w, d], i) => (
        <Star key={i} className={`absolute ${w} animate-twinkle text-sun`} style={{ left: l, top: t, animationDelay: d }} />
      ))}
    </div>
  )
}
