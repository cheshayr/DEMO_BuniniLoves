import { Children, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Swipeable carousel built on native scroll-snap: touch-swipe and trackpad work for free, arrow buttons and
 * dots appear only when there is more to scroll, and the track is keyboard-focusable (← → keys).
 * `itemClass` sets how many cards are visible per breakpoint.
 */
export function Carousel({ children, label, itemClass = 'w-[72%] sm:w-[42%] lg:w-[23.5%]' }: { children: ReactNode; label: string; itemClass?: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [state, setState] = useState({ pages: 1, page: 0, atStart: true, atEnd: true })

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    const pages = Math.max(1, Math.round(el.scrollWidth / Math.max(1, el.clientWidth)))
    const max = el.scrollWidth - el.clientWidth
    const atStart = el.scrollLeft <= 2
    const atEnd = el.scrollLeft >= max - 2
    const page = atEnd ? pages - 1 : Math.min(pages - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
    setState((s) => (s.pages === pages && s.page === page && s.atStart === atStart && s.atEnd === atEnd ? s : { pages, page, atStart, atEnd }))
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, Children.count(children)])

  const scrollByPage = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? 'auto' : 'smooth' })
  }
  const goToPage = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' })
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollByPage(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); scrollByPage(-1) }
  }

  const scrollable = state.pages > 1
  const btn = 'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border-2 border-ink-950 bg-white shadow-sticker transition hover:bg-star disabled:pointer-events-none disabled:opacity-0 md:grid'

  return (
    <section aria-roledescription="carousel" aria-label={label} className="relative">
      <div ref={track} tabIndex={0} role="group" aria-label={`${label}, use arrow keys to browse`} onScroll={measure} onKeyDown={onKey}
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-4 pt-1 outline-none [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-bun-ribbon sm:gap-5 [&::-webkit-scrollbar]:hidden">
        {Children.toArray(children).map((child, i) => <div key={i} className={`shrink-0 snap-start ${itemClass}`}>{child}</div>)}
      </div>
      {scrollable && (
        <>
          <button type="button" onClick={() => scrollByPage(-1)} disabled={state.atStart} aria-label="Previous" className={`${btn} -left-4 lg:-left-6`}><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => scrollByPage(1)} disabled={state.atEnd} aria-label="Next" className={`${btn} -right-4 lg:-right-6`}><ChevronRight className="h-5 w-5" /></button>
          <div className="mt-1 flex justify-center gap-2" role="tablist" aria-label={`${label} pages`}>
            {Array.from({ length: state.pages }, (_, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === state.page} aria-label={`Page ${i + 1} of ${state.pages}`} onClick={() => goToPage(i)}
                className={`h-2.5 rounded-full border-2 border-ink-950 transition-all ${i === state.page ? 'w-7 bg-star' : 'w-2.5 bg-white hover:bg-bun'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
