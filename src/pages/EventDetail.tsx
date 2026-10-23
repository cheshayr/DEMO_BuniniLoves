import { Link, useParams } from 'react-router-dom'
import { CalendarPlus, Clock, Download, ExternalLink, MapPin, Store } from 'lucide-react'
import { downloadIcs, fetchEvent, formatEventWhen, googleCalendarUrl, safeUrl } from '@/lib/community'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'

export default function EventDetail() {
  const { slug = '' } = useParams()
  const { data: e, loading, error } = useAsync(() => fetchEvent(slug), [slug])

  if (loading) return <section className="container-x max-w-4xl py-12"><div className="skeleton h-72" /></section>
  if (error) return <section className="container-x max-w-4xl py-12"><ErrorState message={error} /></section>
  if (!e) return <section className="container-x max-w-4xl py-12"><EmptyState title="event not found" action={<Link to="/events" className="btn-primary btn-sm">All events</Link>}>It may have been removed.</EmptyState></section>

  const when = formatEventWhen(e.starts_at, e.ends_at)
  const pageUrl = `${window.location.origin}${window.location.pathname}#/events/${e.slug}`
  const ended = new Date(e.ends_at).getTime() < Date.now()
  const link = safeUrl(e.external_url)
  const where = [e.venue, e.address].filter(Boolean).join(', ')
  const paragraphs = (t: string) => t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  return (
    <article className="container-x max-w-4xl py-12">
      <Link to="/events" className="text-sm font-semibold text-milk/70 hover:text-bun-ribbon">← All events</Link>
      <div className="mt-4 grid items-start gap-8 md:grid-cols-[1fr_20rem]">
        <div>
          {ended && <span className="badge-muted mb-3">This event has ended</span>}
          <h1 className="text-4xl font-semibold">{e.name}</h1>
          <dl className="mt-5 grid gap-3">
            <div className="flex items-start gap-3"><Clock className="mt-0.5 h-5 w-5 shrink-0 text-bun-ribbon" /><div><dt className="sr-only">When</dt><dd className="font-semibold">{when.date}</dd><dd className="text-sm text-milk/65">{when.time} (Philippine time)</dd></div></div>
            <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-bun-ribbon" /><div><dt className="sr-only">Where</dt><dd className="font-semibold">{e.venue}</dd>{e.address && <dd className="text-sm text-milk/65">{e.address}</dd>}
              <dd><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-bun-ribbon hover:underline">Open in Google Maps</a></dd></div></div>
            {e.booth && <div className="flex items-start gap-3"><Store className="mt-0.5 h-5 w-5 shrink-0 text-bun-ribbon" /><div><dt className="sr-only">Booth</dt><dd className="font-semibold">Booth {e.booth}</dd></div></div>}
          </dl>

          {e.description && <div className="mt-6 grid gap-3 text-milk/85">{paragraphs(e.description).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>}
          {e.participation_info && (
            <div className="mt-6 rounded-2xl border-2 border-ink-950 bg-cloud-soft p-4">
              <h2 className="font-display text-lg font-semibold">how to join / what to expect</h2>
              <div className="mt-2 grid gap-2 text-sm text-milk/85">{paragraphs(e.participation_info).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
            </div>
          )}
        </div>

        <aside className="grid gap-4">
          {e.poster_url && <img src={e.poster_url} alt={`Poster for ${e.name}`} className="w-full rounded-3xl border-2 border-ink-950 shadow-card" />}
          {!ended && (
            <div className="card grid gap-2 p-4">
              <p className="font-display font-semibold">add to calendar</p>
              <a href={googleCalendarUrl(e, pageUrl)} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm"><CalendarPlus className="h-4 w-4" /> Google Calendar</a>
              <button onClick={() => downloadIcs(e, pageUrl)} className="btn-ghost btn-sm"><Download className="h-4 w-4" /> Apple / Outlook (.ics)</button>
            </div>
          )}
          {link && <a href={link} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm"><ExternalLink className="h-4 w-4" /> Event page</a>}
        </aside>
      </div>
    </article>
  )
}
