import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ImagePlus, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import {
  deleteEvent, deleteNews, fetchAdminEvents, fetchAdminNews, formatEventWhen, fromDateTimeLocal, NEWS_CATEGORIES, removeCommunityImage,
  safeUrl, saveEvent, saveNews, toDateTimeLocal, uploadCommunityImage,
} from '@/lib/community'
import type { EventFull, EventInput, NewsInput, NewsPost } from '@/lib/community'
import { slugify } from '@/lib/admin'
import { formatDate } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ConfirmDialog, FieldRow, ListSkeleton, Modal, PageHeader, Toggle, useToast } from '@/components/admin/ui'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
type Status = 'draft' | 'published' | 'archived'
const STATUS_TEXT: Record<Status, string> = { published: 'Published', draft: 'Draft', archived: 'Archived' }
const statusTone = (s: Status) => (s === 'published' ? 'badge-cloud' : s === 'draft' ? 'badge-star' : 'badge-muted')
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/* ---------- image field (uploads right away; cleans up anything that ends up unused) ---------- */

function useImageField(folder: 'news' | 'events', initial: string | null) {
  const [url, setUrl] = useState<string | null>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fresh = useRef<string[]>([])
  const saved = useRef(false)

  // closing the editor without saving removes files uploaded during this session
  useEffect(() => () => { if (!saved.current) fresh.current.forEach((u) => { removeCommunityImage(u) }) }, [])

  const drop = (u: string | null) => {
    if (u && fresh.current.includes(u)) { fresh.current = fresh.current.filter((x) => x !== u); removeCommunityImage(u) }
  }
  const upload = async (file: File) => {
    setBusy(true); setError('')
    try { const u = await uploadCommunityImage(folder, file); drop(url); fresh.current.push(u); setUrl(u) } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  const clear = () => { drop(url); setUrl(null) }
  /** call after a successful save */
  const commit = () => {
    saved.current = true
    if (initial && initial !== url) removeCommunityImage(initial)
    fresh.current.filter((u) => u !== url).forEach((u) => { removeCommunityImage(u) })
  }
  return { url, busy, error, upload, clear, commit }
}

function ImageField({ label, field }: { label: string; field: ReturnType<typeof useImageField> }) {
  const pick = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) field.upload(f) }
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        {field.url && <img src={field.url} alt="" className="h-20 w-28 rounded-xl border-2 border-ink-950 object-cover" />}
        <label className={`btn-ghost btn-sm cursor-pointer focus-within:ring-2 focus-within:ring-ink-950 focus-within:ring-offset-2 ${field.busy ? 'pointer-events-none opacity-50' : ''}`}>
          <ImagePlus className="h-4 w-4" /> {field.busy ? 'Uploading…' : field.url ? 'Replace image' : 'Upload image'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={field.busy} className="sr-only" />
        </label>
        {field.url && <button type="button" onClick={field.clear} className="text-sm font-bold text-bun-ribbon hover:underline">Remove</button>}
      </div>
      {field.error && <p role="alert" className="field-error">{field.error}</p>}
      <p className="mt-1.5 text-xs text-milk/55">JPG, PNG or WebP, up to 5 MB.</p>
    </div>
  )
}

const StatusSelect = ({ value, onChange }: { value: Status; onChange: (s: Status) => void }) => (
  <FieldRow label="Status" hint={value === 'published' ? 'Visible to everyone.' : value === 'draft' ? 'Only you can see it.' : 'Hidden, kept for your records.'}>
    <select value={value} onChange={(e) => onChange(e.target.value as Status)} className="input">
      <option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
    </select>
  </FieldRow>
)

/* ---------- news ---------- */

function NewsForm({ post, onDone }: { post: NewsPost | null; onDone: (changed: boolean) => void }) {
  const toast = useToast()
  const cover = useImageField('news', post?.cover_url ?? null)
  const [title, setTitle] = useState(post?.title ?? '')
  const [slug, setSlug] = useState(post?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(post))
  const [category, setCategory] = useState(post?.category ?? 'news')
  const [content, setContent] = useState(post?.content ?? '')
  const [status, setStatus] = useState<Status>(post?.status ?? 'draft')
  const [pinned, setPinned] = useState(post?.is_pinned ?? false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const t = title.trim()
    if (t.length < 3 || t.length > 140) errs.title = 'Title must be 3–140 characters.'
    if (!SLUG_RE.test(slug.trim()) || slug.length > 80) errs.slug = 'Lowercase letters, numbers and dashes only.'
    if (content.length > 20000) errs.content = 'Too long (20,000 characters max).'
    if (status === 'published' && !content.trim()) errs.content = 'Write something before publishing.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const input: NewsInput = { slug: slug.trim(), title: t, category, cover_url: cover.url, content: content.trim(), status, is_pinned: pinned }
    setBusy(true)
    try { await saveNews(post?.id ?? null, input); cover.commit(); toast(post ? 'Post saved' : 'Post created'); onDone(true) } catch (err) { toast(errMsg(err), 'error'); setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FieldRow label="Title" error={errors.title}><input value={title} maxLength={140} className={`input ${errors.title ? 'input-error' : ''}`} onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} /></FieldRow>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="URL name" error={errors.slug} hint={`/news/${slug || '…'}`}><input value={slug} maxLength={80} className={`input ${errors.slug ? 'input-error' : ''}`} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true) }} /></FieldRow>
        <FieldRow label="Category"><select value={category} onChange={(e) => setCategory(e.target.value)} className="input capitalize">{NEWS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></FieldRow>
      </div>
      <ImageField label="Cover image (optional)" field={cover} />
      <FieldRow label="Content" error={errors.content} hint="Plain text. Leave a blank line between paragraphs."><textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className={`input ${errors.content ? 'input-error' : ''}`} /></FieldRow>
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <StatusSelect value={status} onChange={setStatus} />
        <div className="flex items-center gap-3 pb-2"><Toggle checked={pinned} onChange={setPinned} label="Pin to the top" /><span className="text-sm font-semibold">Pin to the top</span></div>
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => onDone(false)} className="btn-ghost btn-sm" disabled={busy}>Cancel</button><button className="btn-primary btn-sm" disabled={busy || cover.busy}>{busy ? 'Saving…' : 'Save post'}</button></div>
    </form>
  )
}

function NewsPanel() {
  const toast = useToast()
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useAsync(fetchAdminNews, [tick])
  const [editing, setEditing] = useState<NewsPost | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<NewsPost | null>(null)
  const [busy, setBusy] = useState(false)
  const reload = () => setTick((t) => t + 1)

  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    try { await deleteNews(toDelete.id); await removeCommunityImage(toDelete.cover_url); toast('Post deleted'); setToDelete(null); reload() } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <div className="mb-4 flex justify-end"><button onClick={() => setEditing('new')} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New post</button></div>
      {loading && !data ? <ListSkeleton rows={4} /> : error || !data ? <ErrorState message={error ?? 'Could not load posts.'} />
        : data.length === 0 ? <EmptyState title="no posts yet" action={<button onClick={() => setEditing('new')} className="btn-primary btn-sm">Write your first post</button>}>Share restocks, bazaar news or little stories.</EmptyState>
        : (
          <ul className="grid gap-3">
            {data.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold"><span className="truncate">{p.title}</span><span className={statusTone(p.status)}>{STATUS_TEXT[p.status]}</span>{p.is_pinned && <span className="badge-star"><Pin className="h-3 w-3" /> Pinned</span>}</p>
                  <p className="text-sm capitalize text-milk/65">{p.category}{p.published_at ? ` · ${formatDate(p.published_at)}` : ''}</p>
                </div>
                <div className="flex items-center gap-1">
                  {p.status === 'published' && <Link to={`/news/${p.slug}`} target="_blank" className="btn-ghost btn-sm">View</Link>}
                  <button onClick={() => setEditing(p)} aria-label={`Edit ${p.title}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink-950/10"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setToDelete(p)} aria-label={`Delete ${p.title}`} className="grid h-9 w-9 place-items-center rounded-full text-bun-ribbon hover:bg-bun-deep/15"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'new post' : 'edit post'} wide>
        {editing !== null && <NewsForm key={editing === 'new' ? 'new' : editing.id} post={editing === 'new' ? null : editing} onDone={(c) => { setEditing(null); if (c) reload() }} />}
      </Modal>
      <ConfirmDialog open={!!toDelete} busy={busy} onCancel={() => setToDelete(null)} onConfirm={remove} title="Delete this post?" confirmLabel="Delete post" message={<>“{toDelete?.title}” will be removed for good. To just hide it, set it to Draft or Archived instead.</>} />
    </>
  )
}

/* ---------- events ---------- */

function EventForm({ event, onDone }: { event: EventFull | null; onDone: (changed: boolean) => void }) {
  const toast = useToast()
  const poster = useImageField('events', event?.poster_url ?? null)
  const [name, setName] = useState(event?.name ?? '')
  const [slug, setSlug] = useState(event?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(event))
  const [starts, setStarts] = useState(event ? toDateTimeLocal(event.starts_at) : '')
  const [ends, setEnds] = useState(event ? toDateTimeLocal(event.ends_at) : '')
  const [venue, setVenue] = useState(event?.venue ?? '')
  const [address, setAddress] = useState(event?.address ?? '')
  const [booth, setBooth] = useState(event?.booth ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [participation, setParticipation] = useState(event?.participation_info ?? '')
  const [link, setLink] = useState(event?.external_url ?? '')
  const [status, setStatus] = useState<Status>(event?.status ?? 'draft')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const n = name.trim()
    if (n.length < 3 || n.length > 140) errs.name = 'Name must be 3–140 characters.'
    if (!SLUG_RE.test(slug.trim()) || slug.length > 80) errs.slug = 'Lowercase letters, numbers and dashes only.'
    const s = fromDateTimeLocal(starts)
    const en = fromDateTimeLocal(ends)
    if (!s) errs.starts = 'Pick a start date and time.'
    if (!en) errs.ends = 'Pick an end date and time.'
    if (s && en && en < s) errs.ends = 'The event can’t end before it starts.'
    if (venue.trim().length < 2 || venue.length > 140) errs.venue = 'Enter the venue (2–140 characters).'
    if (address.length > 200) errs.address = 'Keep it under 200 characters.'
    if (booth.length > 40) errs.booth = 'Keep it under 40 characters.'
    if (description.length > 5000) errs.description = 'Too long (5,000 characters max).'
    if (participation.length > 2000) errs.participation = 'Too long (2,000 characters max).'
    if (link.trim() && !safeUrl(link)) errs.link = 'Use a full link starting with https://'
    setErrors(errs)
    if (Object.keys(errs).length || !s || !en) return
    const input: EventInput = {
      slug: slug.trim(), name: n, starts_at: s, ends_at: en, venue: venue.trim(), address: address.trim() || null, description: description.trim(),
      booth: booth.trim() || null, poster_url: poster.url, external_url: link.trim() || null, participation_info: participation.trim() || null, status,
    }
    setBusy(true)
    try { await saveEvent(event?.id ?? null, input); poster.commit(); toast(event ? 'Event saved' : 'Event created'); onDone(true) } catch (err) { toast(errMsg(err), 'error'); setBusy(false) }
  }
  const cls = (k: string) => `input ${errors[k] ? 'input-error' : ''}`

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FieldRow label="Event name" error={errors.name}><input value={name} maxLength={140} className={cls('name')} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} /></FieldRow>
      <FieldRow label="URL name" error={errors.slug} hint={`/events/${slug || '…'}`}><input value={slug} maxLength={80} className={cls('slug')} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true) }} /></FieldRow>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Starts (Philippine time)" error={errors.starts}><input type="datetime-local" value={starts} onChange={(e) => { setStarts(e.target.value); if (!ends) setEnds(e.target.value) }} className={cls('starts')} /></FieldRow>
        <FieldRow label="Ends (Philippine time)" error={errors.ends}><input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} className={cls('ends')} /></FieldRow>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Venue" error={errors.venue}><input value={venue} maxLength={140} onChange={(e) => setVenue(e.target.value)} className={cls('venue')} placeholder="e.g. SM Megamall Event Centre" /></FieldRow>
        <FieldRow label="Booth (optional)" error={errors.booth}><input value={booth} maxLength={40} onChange={(e) => setBooth(e.target.value)} className={cls('booth')} placeholder="e.g. B-12" /></FieldRow>
      </div>
      <FieldRow label="Address (optional)" error={errors.address}><input value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} className={cls('address')} /></FieldRow>
      <FieldRow label="Description" error={errors.description} hint="Plain text. Blank line = new paragraph."><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={cls('description')} /></FieldRow>
      <FieldRow label="How to join / what to expect (optional)" error={errors.participation}><textarea value={participation} onChange={(e) => setParticipation(e.target.value)} rows={3} className={cls('participation')} /></FieldRow>
      <FieldRow label="Event link (optional)" error={errors.link}><input value={link} onChange={(e) => setLink(e.target.value)} className={cls('link')} placeholder="https://" /></FieldRow>
      <ImageField label="Poster (optional)" field={poster} />
      <StatusSelect value={status} onChange={setStatus} />
      <div className="flex justify-end gap-2"><button type="button" onClick={() => onDone(false)} className="btn-ghost btn-sm" disabled={busy}>Cancel</button><button className="btn-primary btn-sm" disabled={busy || poster.busy}>{busy ? 'Saving…' : 'Save event'}</button></div>
    </form>
  )
}

function EventsPanel() {
  const toast = useToast()
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useAsync(fetchAdminEvents, [tick])
  const [editing, setEditing] = useState<EventFull | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<EventFull | null>(null)
  const [busy, setBusy] = useState(false)
  const reload = () => setTick((t) => t + 1)

  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    try { await deleteEvent(toDelete.id); await removeCommunityImage(toDelete.poster_url); toast('Event deleted'); setToDelete(null); reload() } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <div className="mb-4 flex justify-end"><button onClick={() => setEditing('new')} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New event</button></div>
      {loading && !data ? <ListSkeleton rows={4} /> : error || !data ? <ErrorState message={error ?? 'Could not load events.'} />
        : data.length === 0 ? <EmptyState title="no events yet" action={<button onClick={() => setEditing('new')} className="btn-primary btn-sm">Add your first event</button>}>Add a bazaar or expo so customers can find you.</EmptyState>
        : (
          <ul className="grid gap-3">
            {data.map((ev) => {
              const when = formatEventWhen(ev.starts_at, ev.ends_at)
              const over = new Date(ev.ends_at).getTime() < Date.now()
              return (
                <li key={ev.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold"><span className="truncate">{ev.name}</span><span className={statusTone(ev.status)}>{STATUS_TEXT[ev.status]}</span>{over && <span className="badge-muted">Ended</span>}</p>
                    <p className="text-sm text-milk/65">{when.date} · {when.time} · {ev.venue}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {ev.status === 'published' && <Link to={`/events/${ev.slug}`} target="_blank" className="btn-ghost btn-sm">View</Link>}
                    <button onClick={() => setEditing(ev)} aria-label={`Edit ${ev.name}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink-950/10"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setToDelete(ev)} aria-label={`Delete ${ev.name}`} className="grid h-9 w-9 place-items-center rounded-full text-bun-ribbon hover:bg-bun-deep/15"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'new event' : 'edit event'} wide>
        {editing !== null && <EventForm key={editing === 'new' ? 'new' : editing.id} event={editing === 'new' ? null : editing} onDone={(c) => { setEditing(null); if (c) reload() }} />}
      </Modal>
      <ConfirmDialog open={!!toDelete} busy={busy} onCancel={() => setToDelete(null)} onConfirm={remove} title="Delete this event?" confirmLabel="Delete event" message={<>“{toDelete?.name}” will be removed for good. To just hide it, set it to Draft or Archived instead.</>} />
    </>
  )
}

export default function AdminCommunity() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'events' ? 'events' : 'news'
  const tabBtn = (id: 'news' | 'events', label: string) => (
    <button key={id} role="tab" aria-selected={tab === id} onClick={() => setParams(id === 'news' ? {} : { tab: id }, { replace: true })}
      className={`rounded-full border-2 border-ink-950 px-5 py-2 font-display text-sm font-semibold transition ${tab === id ? 'bg-star' : 'bg-white hover:bg-cloud-soft'}`}>{label}</button>
  )
  return (
    <>
      <PageHeader eyebrow="community" title="news & events">
        <div role="tablist" aria-label="Content type" className="flex gap-2">{tabBtn('news', 'News')}{tabBtn('events', 'Events')}</div>
      </PageHeader>
      {tab === 'news' ? <NewsPanel /> : <EventsPanel />}
    </>
  )
}
