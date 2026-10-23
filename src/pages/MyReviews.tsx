import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ImagePlus, Star as StarIcon, Trash2 } from 'lucide-react'
import { deleteReview, fetchMyReviewData, IMAGE_TYPES, MAX_REVIEW_PHOTO, submitReview } from '@/lib/community'
import type { MyReview, ReviewableItem } from '@/lib/community'
import { formatDate } from '@/lib/format'
import { reviewPhotoUrl } from '@/lib/products'
import { useAsync } from '@/lib/useAsync'
import { useAuth } from '@/context/AuthContext'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Stars } from '@/components/ui/Stars'

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Your rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => onChange(n)}
          className="rounded-full p-1 transition hover:scale-110">
          <StarIcon className={`h-8 w-8 ${n <= value ? 'fill-star text-ink-950' : 'text-ink-950/30'}`} strokeLinejoin="round" />
        </button>
      ))}
    </div>
  )
}

function ReviewForm({ item, userId, onDone }: { item: ReviewableItem; userId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!photo) { setPreview(null); return }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!f) return
    if (!IMAGE_TYPES[f.type]) return setError('Please choose a JPG, PNG or WebP photo.')
    if (f.size > MAX_REVIEW_PHOTO) return setError('Photos must be 3 MB or smaller.')
    setError(''); setPhoto(f)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (rating < 1) return setError('Tap a star to rate this item.')
    if (body.trim().length < 3) return setError('Tell us a little about it (at least a few words).')
    if (body.length > 2000) return setError('Please keep it under 2,000 characters.')
    setBusy(true); setError('')
    try { await submitReview({ userId, item, rating, body, photo }); onDone() } catch (err) { setError(msg(err)); setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4 border-t-2 border-ink-950/10 pt-4">
      <StarPicker value={rating} onChange={setRating} />
      <div>
        <label htmlFor={`rv-${item.id}`} className="label">Your review</label>
        <textarea id={`rv-${item.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} placeholder="What did you love? How was the quality?" className="input" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-ghost btn-sm cursor-pointer focus-within:ring-2 focus-within:ring-ink-950 focus-within:ring-offset-2">
          <ImagePlus className="h-4 w-4" /> {photo ? 'Change photo' : 'Add a photo (optional)'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="sr-only" />
        </label>
        {preview && <><img src={preview} alt="Selected photo preview" className="h-14 w-14 rounded-xl border-2 border-ink-950 object-cover" /><button type="button" onClick={() => setPhoto(null)} className="text-sm font-bold text-bun-ribbon hover:underline">Remove</button></>}
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
      <div><button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Posting…' : 'Post review'}</button></div>
    </form>
  )
}

function Pending({ item, userId, onDone }: { item: ReviewableItem; userId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-display text-lg font-semibold">{item.product_name}</p><p className="text-sm text-milk/65">{item.variant_name ? `${item.variant_name} · ` : ''}Order {item.order_number}</p></div>
        {!open && <button onClick={() => setOpen(true)} className="btn-primary btn-sm">Write a review</button>}
      </div>
      {open && <ReviewForm item={item} userId={userId} onDone={onDone} />}
    </li>
  )
}

function Mine({ r, onDeleted }: { r: MyReview; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const photo = reviewPhotoUrl(r.photo_path)
  const remove = async () => {
    if (!window.confirm('Delete this review? This can’t be undone.')) return
    setBusy(true); setError('')
    try { await deleteReview(r); onDeleted() } catch (e) { setError(msg(e)); setBusy(false) }
  }
  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-lg font-semibold">{r.product_name}</p>
        <Stars value={r.rating} />
      </div>
      <p className="mt-2 whitespace-pre-line text-milk/85">{r.body}</p>
      {photo && <img src={photo} alt="Your review photo" loading="lazy" className="mt-3 h-32 rounded-2xl border-2 border-ink-950 object-cover" />}
      {r.is_hidden && <p className="mt-3 rounded-2xl bg-bun-soft p-3 text-sm">This review is hidden from the shop. Contact us if you think that's a mistake.</p>}
      {r.admin_reply && <div className="mt-3 rounded-2xl bg-star/50 p-3 text-sm"><p className="font-display font-semibold text-bun-ribbon">Reply from bunini loves</p><p className="mt-1 whitespace-pre-line text-milk/80">{r.admin_reply}</p></div>}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-milk/50">{formatDate(r.created_at)}</span>
        <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1 text-sm font-bold text-bun-ribbon hover:underline disabled:opacity-50"><Trash2 className="h-4 w-4" /> {busy ? 'Deleting…' : 'Delete'}</button>
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
    </li>
  )
}

export default function MyReviews() {
  const { user } = useAuth()
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useAsync(() => fetchMyReviewData(user?.id ?? ''), [user?.id, tick])
  const reload = () => setTick((t) => t + 1)

  return (
    <section className="container-x max-w-3xl py-12">
      <Link to="/account" className="text-sm font-semibold text-milk/70 hover:text-bun-ribbon">← My account</Link>
      <p className="eyebrow mt-3">share the love</p>
      <h1 className="mt-1 text-4xl font-semibold">my reviews</h1>
      <p className="mt-2 text-milk/65">You can review items once your order has been delivered.</p>

      <div className="mt-8 grid gap-10">
        {loading && !data ? <div className="grid gap-3">{[0, 1].map((i) => <div key={i} className="skeleton h-24" />)}</div>
          : error || !data ? <ErrorState message={error ?? 'Could not load your reviews.'} />
          : (
            <>
              <div>
                <h2 className="text-2xl font-semibold">waiting for your review</h2>
                {data.pending.length === 0
                  ? <div className="mt-3"><EmptyState title="all caught up">Nothing to review right now. Delivered items you haven't reviewed will show up here.</EmptyState></div>
                  : <ul className="mt-3 grid gap-3">{data.pending.map((i) => <Pending key={i.id} item={i} userId={user?.id ?? ''} onDone={reload} />)}</ul>}
              </div>
              {data.mine.length > 0 && (
                <div>
                  <h2 className="text-2xl font-semibold">your reviews</h2>
                  <ul className="mt-3 grid gap-3">{data.mine.map((r) => <Mine key={r.id} r={r} onDeleted={reload} />)}</ul>
                </div>
              )}
            </>
          )}
      </div>
    </section>
  )
}
