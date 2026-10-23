import { Link } from 'react-router-dom'
import { Pin } from 'lucide-react'
import { fetchNews } from '@/lib/community'
import { formatDate } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { asset } from '@/lib/assets'

export function CoverImage({ url, className = '' }: { url: string | null; className?: string }) {
  return url
    ? <img src={url} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />
    : <div className={`grid h-full w-full place-items-center bg-bun-soft ${className}`}><img src={asset('/art/bunny-glasses.png')} alt="" width={72} height={72} className="h-16 w-16 opacity-80" /></div>
}

export default function News() {
  const { data, loading, error } = useAsync(fetchNews, [])
  return (
    <section className="container-x py-12">
      <p className="eyebrow">what's new</p>
      <h1 className="mt-1 text-4xl font-semibold">news &amp; updates</h1>
      <p className="mt-2 max-w-xl text-milk/65">Restocks, bazaar news and little stories from the Bunini Loves desk.</p>

      <div className="mt-8">
        {loading ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-72" />)}</div>
          : error ? <ErrorState message={error} />
          : !data?.length ? <EmptyState title="nothing yet">No news right now. Follow us on Instagram while you wait ♡</EmptyState>
          : (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {data.map((p) => (
                <li key={p.id}>
                  <Link to={`/news/${p.slug}`} className="card card-hover flex h-full flex-col overflow-hidden">
                    <div className="aspect-video border-b-2 border-ink-950"><CoverImage url={p.cover_url} /></div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge-pink capitalize">{p.category}</span>
                        {p.is_pinned && <span className="badge-star"><Pin className="h-3 w-3" /> Pinned</span>}
                      </div>
                      <h2 className="mt-3 text-xl font-semibold">{p.title}</h2>
                      <p className="mt-2 line-clamp-3 text-sm text-milk/70">{p.content.replace(/\s+/g, ' ').slice(0, 160)}</p>
                      {p.published_at && <p className="mt-auto pt-4 text-xs text-milk/50">{formatDate(p.published_at, { dateStyle: 'long' })}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </div>
    </section>
  )
}
