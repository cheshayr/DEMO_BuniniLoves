import { Link } from 'react-router-dom'
import { CalendarDays, MapPin } from 'lucide-react'
import { fetchEvents, formatEventWhen } from '@/lib/community'
import type { EventFull } from '@/lib/community'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'

function EventCard({ e, past }: { e: EventFull; past?: boolean }) {
  const when = formatEventWhen(e.starts_at, e.ends_at)
  return (
    <li>
      <Link to={`/events/${e.slug}`} className={`card card-hover flex h-full flex-col overflow-hidden ${past ? 'opacity-70' : ''}`}>
        {e.poster_url && <div className="aspect-[4/3] border-b-2 border-ink-950"><img src={e.poster_url} alt="" loading="lazy" className="h-full w-full object-cover" /></div>}
        <div className="flex flex-1 flex-col p-5">
          <span className={`${past ? 'badge-muted' : 'badge-star'} w-fit`}><CalendarDays className="h-3.5 w-3.5" /> {when.date}</span>
          <h2 className="mt-3 text-xl font-semibold">{e.name}</h2>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-milk/70"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-bun-ribbon" /> {e.venue}</p>
          <p className="mt-1 text-sm text-milk/65">{when.time}</p>
          {e.booth && <p className="mt-2 text-sm font-semibold">Booth {e.booth}</p>}
        </div>
      </Link>
    </li>
  )
}

export default function Events() {
  const { data, loading, error } = useAsync(fetchEvents, [])
  const now = Date.now()
  const upcoming = (data ?? []).filter((e) => new Date(e.ends_at).getTime() >= now)
  const past = (data ?? []).filter((e) => new Date(e.ends_at).getTime() < now).reverse()

  return (
    <section className="container-x py-12">
      <p className="eyebrow">come say hi</p>
      <h1 className="mt-1 text-4xl font-semibold">events &amp; bazaars</h1>
      <p className="mt-2 max-w-xl text-milk/65">Find us at bazaars and expos. Add the dates to your calendar so you don't miss us.</p>

      <div className="mt-8">
        {loading ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-64" />)}</div>
          : error ? <ErrorState message={error} />
          : (
            <>
              {upcoming.length === 0
                ? <EmptyState title="no upcoming events">We'll announce our next bazaar here soon. Check back or follow us on Instagram ♡</EmptyState>
                : <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</ul>}
              {past.length > 0 && (
                <div className="mt-14">
                  <h2 className="text-2xl font-semibold">past events</h2>
                  <ul className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{past.map((e) => <EventCard key={e.id} e={e} past />)}</ul>
                </div>
              )}
            </>
          )}
      </div>
    </section>
  )
}
