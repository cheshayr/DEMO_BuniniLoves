import { useState, type FormEvent } from 'react'
import { EyeOff, Eye, MessageSquare, Trash2 } from 'lucide-react'
import { deleteReview, fetchAdminReviews, replyToReview, REVIEW_PAGE, setReviewHidden } from '@/lib/community'
import type { AdminReview, ReviewFilter } from '@/lib/community'
import { formatDate } from '@/lib/format'
import { reviewPhotoUrl } from '@/lib/products'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Stars } from '@/components/ui/Stars'
import { ConfirmDialog, ListSkeleton, Modal, PageHeader, Pager, useToast } from '@/components/admin/ui'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
const FILTERS: { id: ReviewFilter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'unanswered', label: 'Needs a reply' }, { id: 'hidden', label: 'Hidden' }]

function ReplyForm({ review, onDone }: { review: AdminReview; onDone: (changed: boolean) => void }) {
  const toast = useToast()
  const [text, setText] = useState(review.admin_reply ?? '')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try { await replyToReview(review.id, text); toast(text.trim() ? 'Reply posted' : 'Reply removed'); onDone(true) } catch (err) { toast(errMsg(err), 'error'); setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="rounded-2xl bg-bun-soft/60 p-3 text-sm"><Stars value={review.rating} /><p className="mt-1 whitespace-pre-line">{review.body}</p></div>
      <label className="block"><span className="label">Your public reply</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1000} autoFocus className="input" placeholder="Thank you so much! ♡" />
        <span className="mt-1.5 block text-xs text-milk/55">Shown under the review on the product page. Leave empty to remove your reply.</span></label>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => onDone(false)} className="btn-ghost btn-sm" disabled={busy}>Cancel</button><button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save reply'}</button></div>
    </form>
  )
}

export default function AdminReviews() {
  const toast = useToast()
  const [filter, setFilter] = useState<ReviewFilter>('unanswered')
  const [page, setPage] = useState(1)
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useAsync(() => fetchAdminReviews(filter, page), [filter, page, tick])
  const [replying, setReplying] = useState<AdminReview | null>(null)
  const [toDelete, setToDelete] = useState<AdminReview | null>(null)
  const [busy, setBusy] = useState(false)
  const reload = () => setTick((t) => t + 1)

  const toggleHidden = async (r: AdminReview) => {
    try { await setReviewHidden(r.id, !r.is_hidden); toast(r.is_hidden ? 'Review is visible again' : 'Review hidden from the shop'); reload() } catch (e) { toast(errMsg(e), 'error') }
  }
  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    try { await deleteReview(toDelete); toast('Review deleted'); setToDelete(null); reload() } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader eyebrow="community" title="reviews">
        <div role="tablist" aria-label="Review filter" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setPage(1) }}
              className={`rounded-full border-2 border-ink-950 px-4 py-1.5 font-display text-sm font-semibold transition ${filter === f.id ? 'bg-star' : 'bg-white hover:bg-cloud-soft'}`}>{f.label}</button>
          ))}
        </div>
      </PageHeader>

      {loading && !data ? <ListSkeleton rows={4} />
        : error || !data ? <ErrorState message={error ?? 'Could not load reviews.'} />
        : data.rows.length === 0 ? <EmptyState title={filter === 'unanswered' ? 'all replied ♡' : filter === 'hidden' ? 'no hidden reviews' : 'no reviews yet'}>{filter === 'all' ? 'Customers can review items after their order is delivered.' : 'Nothing here right now.'}</EmptyState>
        : (
          <>
            <ul className="grid gap-4">
              {data.rows.map((r) => {
                const photo = reviewPhotoUrl(r.photo_path)
                return (
                  <li key={r.id} className={`card p-5 ${r.is_hidden ? 'opacity-70' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-display text-lg font-semibold">{r.product_name}</p><p className="text-sm text-milk/65">{r.reviewer} · {formatDate(r.created_at, { dateStyle: 'medium' })}</p></div>
                      <div className="flex items-center gap-2">{r.is_hidden && <span className="badge-muted">Hidden</span>}<Stars value={r.rating} /></div>
                    </div>
                    <p className="mt-3 whitespace-pre-line text-milk/85">{r.body}</p>
                    {photo && <a href={photo} target="_blank" rel="noopener noreferrer"><img src={photo} alt="Customer photo" loading="lazy" className="mt-3 h-32 rounded-2xl border-2 border-ink-950 object-cover" /></a>}
                    {r.admin_reply && <div className="mt-3 rounded-2xl bg-star/50 p-3 text-sm"><p className="font-display font-semibold text-bun-ribbon">Your reply</p><p className="mt-1 whitespace-pre-line">{r.admin_reply}</p></div>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => setReplying(r)} className="btn-primary btn-sm"><MessageSquare className="h-4 w-4" /> {r.admin_reply ? 'Edit reply' : 'Reply'}</button>
                      <button onClick={() => toggleHidden(r)} className="btn-ghost btn-sm">{r.is_hidden ? <><Eye className="h-4 w-4" /> Show</> : <><EyeOff className="h-4 w-4" /> Hide</>}</button>
                      <button onClick={() => setToDelete(r)} className="btn-ghost btn-sm text-bun-ribbon"><Trash2 className="h-4 w-4" /> Delete</button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <Pager page={page} total={data.total} pageSize={REVIEW_PAGE} onPage={setPage} />
          </>
        )}

      <Modal open={replying !== null} onClose={() => setReplying(null)} title="reply to review">
        {replying && <ReplyForm key={replying.id} review={replying} onDone={(c) => { setReplying(null); if (c) reload() }} />}
      </Modal>
      <ConfirmDialog open={!!toDelete} busy={busy} onCancel={() => setToDelete(null)} onConfirm={remove} title="Delete this review?" confirmLabel="Delete review"
        message="It will be removed for good, including its photo. To just take it off the shop, use Hide instead." />
    </>
  )
}
