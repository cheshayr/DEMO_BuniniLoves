import { Link, useParams } from 'react-router-dom'
import { fetchPost } from '@/lib/community'
import { formatDate } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { CoverImage } from './News'

export default function NewsPost() {
  const { slug = '' } = useParams()
  const { data, loading, error } = useAsync(() => fetchPost(slug), [slug])

  if (loading) return <section className="container-x max-w-3xl py-12"><div className="skeleton h-64" /><div className="skeleton mt-6 h-8 w-2/3" /></section>
  if (error) return <section className="container-x max-w-3xl py-12"><ErrorState message={error} /></section>
  if (!data) return <section className="container-x max-w-3xl py-12"><EmptyState title="post not found" action={<Link to="/news" className="btn-primary btn-sm">Back to news</Link>}>It may have been taken down.</EmptyState></section>

  // Plain text only: paragraphs split on blank lines, line breaks kept. Nothing is ever injected as HTML.
  const paragraphs = data.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return (
    <article className="container-x max-w-3xl py-12">
      <Link to="/news" className="text-sm font-semibold text-milk/70 hover:text-bun-ribbon">← All news</Link>
      <div className="card mt-4 aspect-video overflow-hidden"><CoverImage url={data.cover_url} /></div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="badge-pink capitalize">{data.category}</span>
        {data.published_at && <span className="text-sm text-milk/55">{formatDate(data.published_at, { dateStyle: 'long' })}</span>}
      </div>
      <h1 className="mt-3 text-4xl font-semibold">{data.title}</h1>
      <div className="mt-6 grid gap-4 text-lg leading-relaxed text-milk/85">
        {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
      </div>
    </article>
  )
}
