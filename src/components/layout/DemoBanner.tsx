import { useState } from 'react'
import { FlaskConical, X } from 'lucide-react'

/** Shown on every page of the public showcase so nobody mistakes it for a real store. */
export function DemoBanner() {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div role="note" className="relative border-b-2 border-ink-950 bg-cloud px-10 py-2 text-center text-[12.5px] font-semibold text-ink-950">
      <FlaskConical aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px" />
      Demo store with sample data. Nothing is real, saved or charged. Sign in with any email and password. Try code <span className="rounded bg-star px-1.5 font-mono">WELCOME10</span>. Owner admin: <span className="rounded bg-star px-1.5 font-mono">Admin@gmail.com</span> / <span className="rounded bg-star px-1.5 font-mono">admin1234</span>
      <button onClick={() => setOpen(false)} aria-label="Dismiss demo notice" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full hover:bg-ink-950/10"><X className="h-4 w-4" /></button>
    </div>
  )
}