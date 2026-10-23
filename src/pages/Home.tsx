import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
import { Cloud, Heart, Ribbon, Sparkles, Star } from '@/components/ui/Doodles'
import { Stars } from '@/components/ui/Stars'
import { EmptyState, ProductGridSkeleton } from '@/components/ui/States'
import { ProductCard } from '@/components/product/ProductCard'
import { Carousel } from '@/components/ui/Carousel'
import { SmartLink } from '@/components/ui/SmartLink'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/lib/useAsync'
import { fetchCategories, fetchHomeProducts, fetchProductsByIds, fetchReviewsByIds, fetchTopReviews, fetchUpcomingEvents, reviewPhotoUrl } from '@/lib/products'
import { formatDate } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase'
import { safeImage } from '@/lib/site'
import type { SectionText } from '@/lib/site'
import { asset } from '@/lib/assets'

const COLLECTIONS = [
  { slug: 'stationery', label: 'Stationery', to: '/shop/stationery', tone: 'bg-star-soft text-ink-950' },
  { slug: 'stickers', label: 'Stickers & Sticker Sheets', to: '/shop/stickers', tone: 'bg-bun text-ink-950' },
  { slug: 'notebooks', label: 'Notebooks & Journals', to: '/shop/notebooks', tone: 'bg-cloud text-ink-950' },
  { slug: 'new', label: 'New Arrivals', to: '/shop?filter=new', tone: 'bg-cloud text-ink-950' },
]

/** Headline with the owner's chosen accent word in pink (first match, case-insensitive). Line breaks are kept. */
function Headline({ text, accent }: { text: string; accent: string }) {
  const at = accent.trim() ? text.toLowerCase().indexOf(accent.trim().toLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return <>{text.slice(0, at)}<span className="text-bun-ribbon">{text.slice(at, at + accent.trim().length)}</span>{text.slice(at + accent.trim().length)}</>
}

function SectionHead({ t, action }: { t: SectionText; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>{t.eyebrow && <p className="eyebrow">{t.eyebrow}</p>}<h2 className="section-title mt-1">{t.title}</h2></div>
      {action}
    </div>
  )
}

function Hero() {
  const { site, loaded } = useSettings()
  const h = site.home.hero
  const custom = safeImage(h.image_url)
  return (
    <section className="relative overflow-hidden">
      <Sparkles />
      <div className="container-x relative grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:py-24">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={loaded ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.6, ease: 'easeOut' }}>
          {h.eyebrow && <p className="eyebrow">{h.eyebrow}</p>}
          <h1 className="mt-3 whitespace-pre-line text-5xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">
            <Headline text={h.headline} accent={h.accent} /> <Heart className="inline h-9 w-9 -translate-y-1 text-bun sm:h-12 sm:w-12" />
          </h1>
          <p className="mt-5 max-w-md text-lg text-milk/75">{h.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <SmartLink to={h.primary_link} className="btn-primary">{h.primary_label}</SmartLink>
            {h.secondary_label && <SmartLink to={h.secondary_link} className="btn-ghost">{h.secondary_label}</SmartLink>}
          </div>
        </motion.div>

        {/* The owner can replace this picture in Admin → Site content. */}
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={loaded ? { opacity: 1, scale: 1 } : undefined} transition={{ duration: 0.6, delay: 0.1 }} className="relative mx-auto w-full max-w-lg">
          <div className="absolute inset-x-6 inset-y-4 rotate-2 rounded-4xl border-2 border-ink-950 bg-bun shadow-sticker" aria-hidden="true" />
          <Ribbon className="absolute -left-4 top-6 w-44 -rotate-12 text-bun-ribbon" />
          <Cloud className="absolute -right-3 -top-2 w-28 animate-floaty text-cloud" />
          <Cloud className="absolute -left-5 bottom-6 w-24 animate-floaty text-cloud-soft [animation-delay:1.5s]" />
          <Star className="absolute right-6 top-1/3 w-12 animate-twinkle text-sun" />
          <Star className="absolute bottom-8 right-10 w-8 animate-twinkle text-sun [animation-delay:1s]" />
          {custom
            ? <img src={custom} alt="" fetchPriority="high" className="relative z-10 mx-auto max-h-[26rem] w-[88%] animate-floaty object-contain drop-shadow-[3px_4px_0_rgba(43,26,46,.15)]" />
            : <img src={asset('/art/bunny-duo.png')} alt="Two bunny friends holding hands" width={900} height={594} fetchPriority="high" className="relative z-10 mx-auto w-[88%] animate-floaty drop-shadow-[3px_4px_0_rgba(43,26,46,.15)]" />}
        </motion.div>
      </div>
    </section>
  )
}

function MeetTheBunnies() {
  const { site } = useSettings()
  const m = site.home.meet
  if (!m.enabled) return null
  const img = safeImage(m.image_url, asset('/art/bunny-glasses.png'))
  return (
    <section className="container-x py-10">
      <div className="card relative flex flex-col items-center gap-6 overflow-hidden bg-cloud p-6 sm:flex-row sm:gap-10 sm:p-10">
        <Star className="absolute right-6 top-5 w-10 animate-twinkle text-sun" />
        <Cloud className="absolute -bottom-6 right-24 hidden w-32 text-cloud-soft sm:block" />
        <img src={img} alt={m.image_url ? '' : 'Bunini, the bunny mascot wearing big red glasses'} width={700} height={700} loading="lazy" className="h-36 w-36 shrink-0 -rotate-3 rounded-full border-2 border-ink-950 bg-bun-soft object-cover shadow-sticker sm:h-44 sm:w-44" />
        <div className="text-center sm:text-left">
          {m.eyebrow && <p className="eyebrow !text-ink-950/70">{m.eyebrow}</p>}
          <h2 className="section-title mt-1">{m.title}</h2>
          {m.body && <p className="mt-2 max-w-xl text-milk/80">{m.body}</p>}
          {m.cta_label && <SmartLink to={m.cta_link} className="btn-pink btn-sm mt-4">{m.cta_label}</SmartLink>}
        </div>
      </div>
    </section>
  )
}

function Collections() {
  const { site } = useSettings()
  const t = site.home.collections
  const cats = useAsync(fetchCategories, [])
  if (!t.enabled) return null
  // Only show tiles for categories that exist in the database, so the owner controls what appears.
  const live = new Set((cats.data ?? []).map((c) => c.slug))
  const tiles = COLLECTIONS.filter((c) => c.slug === 'new' || live.has(c.slug) || !isSupabaseConfigured)
  return (
    <section className="container-x py-12">
      <SectionHead t={t} />
      <div className="mt-6">
        <Carousel label="Featured collections" itemClass="w-[64%] sm:w-[38%] lg:w-[23.5%]">
          {tiles.map((c) => (
            <Link key={c.slug} to={c.to} className={`group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-3xl border-2 border-ink-950 p-4 shadow-sticker transition hover:-translate-y-1 ${c.tone}`}>
              <Star className="absolute right-3 top-3 w-7 text-white transition group-hover:rotate-12 group-hover:scale-125" />
              <span className="font-display text-lg font-semibold leading-tight sm:text-xl">{c.label}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold opacity-75">Shop <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </Carousel>
      </div>
    </section>
  )
}

function Featured() {
  const { site, loaded } = useSettings()
  const t = site.home.featured
  const pinKey = site.pinned.products.join(',')
  // The owner's pinned picks come first; if none are pinned (or none are published) we fall back to "featured" products.
  const { data, loading, error } = useAsync(async () => {
    if (!loaded) return null
    const pinned = await fetchProductsByIds(site.pinned.products)
    return pinned.length ? pinned : fetchHomeProducts()
  }, [loaded, pinKey])
  if (!t.enabled) return null
  return (
    <section className="container-x py-12">
      <SectionHead t={t} action={<Link to="/shop" className="btn-ghost btn-sm shrink-0">View all</Link>} />
      <div className="mt-6">
        {loading || !loaded ? <ProductGridSkeleton /> : error || !data?.length ? (
          <EmptyState title="Products are on their way">New treasures will appear here as soon as they're published.</EmptyState>
        ) : (
          <Carousel label="Featured picks">{data.map((p) => <ProductCard key={p.id} product={p} />)}</Carousel>
        )}
      </div>
    </section>
  )
}

function PromoBanner() {
  const { site } = useSettings()
  const promo = site.promo
  if (!promo.enabled || !promo.title) return null
  return (
    <section className="container-x py-8">
      <div className="relative overflow-hidden rounded-4xl border-2 border-ink-950 bg-bun p-8 text-ink-950 shadow-sticker sm:p-12">
        <Star className="absolute right-8 top-6 w-16 animate-twinkle text-sun" />
        <Cloud className="absolute -bottom-4 right-24 w-32 text-cloud" />
        <h2 className="max-w-lg text-3xl font-semibold sm:text-4xl">{promo.title}</h2>
        {promo.text && <p className="mt-2 max-w-md font-medium opacity-80">{promo.text}</p>}
        <SmartLink to={promo.link || '/shop'} className="btn-primary mt-5">{promo.cta || 'Shop now'}</SmartLink>
      </div>
    </section>
  )
}

function Events() {
  const { site } = useSettings()
  const t = site.home.events
  const { data } = useAsync(() => fetchUpcomingEvents(3), [])
  if (!t.enabled || !data?.length) return null
  return (
    <section className="container-x py-12">
      <SectionHead t={t} />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {data.map((e) => (
          <article key={e.id} className="card card-hover flex flex-col p-5">
            <span className="badge-star w-fit"><CalendarDays className="h-3.5 w-3.5" />{formatDate(e.starts_at, { month: 'short', day: 'numeric' })} – {formatDate(e.ends_at, { month: 'short', day: 'numeric' })}</span>
            <h3 className="mt-3 text-xl font-semibold">{e.name}</h3>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-milk/65"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-bun-ribbon" />{e.venue}</p>
            <p className="mt-1 text-sm text-milk/65">{formatDate(e.starts_at, { timeStyle: 'short' })} – {formatDate(e.ends_at, { timeStyle: 'short' })}</p>
            <Link to={`/events/${e.slug}`} className="btn-ghost btn-sm mt-5 w-fit">View event details</Link>
          </article>
        ))}
      </div>
    </section>
  )
}

function Reviews() {
  const { site, loaded } = useSettings()
  const t = site.home.reviews
  const pinKey = site.pinned.reviews.join(',')
  // Only real, approved reviews are shown (the owner can pin favourites). Nothing is fabricated.
  const { data } = useAsync(async () => {
    if (!loaded) return null
    const pinned = await fetchReviewsByIds(site.pinned.reviews)
    return pinned.length ? pinned : fetchTopReviews(6)
  }, [loaded, pinKey])
  if (!t.enabled || !data?.length) return null
  return (
    <section className="container-x py-12">
      <SectionHead t={t} />
      <div className="mt-6">
        <Carousel label="Customer reviews" itemClass="w-[86%] md:w-[48%] lg:w-[32%]">
          {data.map((r) => {
            const photo = reviewPhotoUrl(r.photo_path)
            return (
              <figure key={r.id} className="card h-full p-5">
                <Stars value={r.rating} />
                <blockquote className="mt-3 text-milk/85">{r.body}</blockquote>
                {photo && <img src={photo} alt="Customer's product photo" loading="lazy" className="mt-3 h-36 w-full rounded-2xl object-cover" />}
                <figcaption className="mt-3 flex items-center justify-between text-sm text-milk/60">
                  <span className="font-semibold text-milk">{r.reviewer_name}</span>
                  {r.verified_purchase && <span className="badge-muted">Verified purchase</span>}
                </figcaption>
              </figure>
            )
          })}
        </Carousel>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Collections />
      <Featured />
      <MeetTheBunnies />
      <PromoBanner />
      <Events />
      <Reviews />
    </>
  )
}