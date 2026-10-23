import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Instagram } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field } from '@/components/ui/Field'
import { Cloud, Heart, Star } from '@/components/ui/Doodles'
import { FormMessage } from '@/pages/auth/AuthShell'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

function Page({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="container-x max-w-3xl py-12 sm:py-16">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">{title}</h1>
      <div className="mt-8 grid gap-5 text-milk/75 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-milk [&_li]:ml-5 [&_li]:list-disc [&_a]:text-bun-ribbon [&_a]:underline">{children}</div>
    </section>
  )
}

export function About() {
  return (
    <Page eyebrow="about us" title="hi, we're bunini loves ♡">
      <div className="relative card p-6">
        <Star className="absolute -right-3 -top-4 w-10 animate-twinkle text-sun" />
        <Cloud className="absolute -bottom-5 left-6 w-16 text-cloud" />
        <p>Bunini Loves is a small, independent stationery shop for people who believe tiny things can make a day better: stickers for your planner, notebooks for your thoughts, stationery for everything else.</p>
      </div>
      <p>Every item is picked and designed with care, and we pack each order by hand. You'll also find us at bazaars and art events around the Philippines. Come say hi, we love meeting our customers.</p>
      <div className="flex flex-wrap gap-3">
        <Link to="/shop" className="btn-primary">Shop the collection</Link>
        <a href="https://www.instagram.com/bunini_loves/" target="_blank" rel="noopener noreferrer" className="btn-ghost !no-underline"><Instagram className="h-4 w-4" /> @bunini_loves</a>
      </div>
      <p className="text-xs text-milk/40">Owner: replace this copy with your own story in src/pages/Info.tsx.</p>
    </Page>
  )
}

const FAQS = [
  { q: 'How long does shipping take?', a: 'Orders are packed after payment is confirmed. Delivery within the Philippines usually takes 3–7 business days depending on your location.' },
  { q: 'Which payment methods do you accept?', a: 'GCash, Maya and bank transfer, plus cash on delivery when it is enabled. For GCash, Maya and bank transfer you upload your payment screenshot at checkout and we verify it before packing.' },
  { q: 'How do I know my payment was received?', a: 'Your order shows "Payment verification" after you upload proof, and moves to "Processing" once we confirm it. We never mark an order paid automatically.' },
  { q: 'Can I cancel my order?', a: 'You can cancel from your account while the order is still pending or awaiting payment. After that, please contact us.' },
  { q: 'Where can I track my order?', a: 'Sign in and open My account → Orders. You will see the status timeline, plus the courier and tracking number once shipped.' },
  { q: 'Do you have a physical store?', a: 'We sell online and at bazaars and expos. See Events & Bazaar for where to find us next.' },
  { q: 'Can I leave a review?', a: 'Yes, once your order is marked delivered, open the order in your account and review the items you received.' },
]

export function FAQ() {
  const [term, setTerm] = useState('')
  const results = useMemo(() => {
    const t = term.trim().toLowerCase()
    return t ? FAQS.filter((f) => (f.q + f.a).toLowerCase().includes(t)) : FAQS
  }, [term])
  return (
    <Page eyebrow="help" title="frequently asked">
      <div><label htmlFor="faq-q" className="sr-only">Search FAQs</label><input id="faq-q" type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search questions…" className="input" /></div>
      {results.length === 0 ? <p>No matches. <Link to="/contact">Ask us directly</Link>.</p> : results.map((f) => (
        <details key={f.q} className="card group p-5 open:border-ink-950">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-lg font-semibold text-milk">{f.q}<Heart className="h-5 w-5 shrink-0 text-bun-ribbon transition group-open:rotate-180 group-open:text-gold" /></summary>
          <p className="mt-3">{f.a}</p>
        </details>
      ))}
    </Page>
  )
}

/* Policy copy below is a sensible starting point. The owner should review and edit it before launch. */
export const Shipping = () => (
  <Page eyebrow="policy" title="shipping policy">
    <h2>Where we ship</h2><p>We currently ship within the Philippines.</p>
    <h2>Couriers & fees</h2><p>You choose your courier at checkout (for example J&T Express or LBC). Each courier has its own fee for Metro Manila, the rest of Luzon, the Visayas and Mindanao, shown before you pay. A courier that is temporarily unavailable is crossed out. Free-shipping promos, when active, are announced at the top of the site.</p>
    <h2>Processing & delivery</h2><p>Orders are packed once payment is confirmed (immediately for cash on delivery). Estimated delivery is shown on each product page. Delays can happen during sale seasons and holidays.</p>
    <h2>Tracking</h2><p>When your parcel ships, the courier and tracking number appear on your order page.</p>
  </Page>
)
export const Returns = () => (
  <Page eyebrow="policy" title="return policy">
    <h2>Damaged or wrong items</h2><p>If your order arrives damaged or incorrect, <Link to="/contact">contact us</Link> with your order number and a photo of the item and packaging. We'll make it right with a replacement or refund.</p>
    <h2>Changes of mind</h2><p>Because many items are small paper goods, we generally can't accept returns for change of mind. Please check product details before ordering.</p>
    <h2>Refunds</h2><p>Approved refunds are returned through the payment method you used.</p>
  </Page>
)
export const Privacy = () => (
  <Page eyebrow="policy" title="privacy policy">
    <h2>What we collect</h2><p>Your name, email, shipping address and contact number so we can fulfill your order, plus payment proof you upload for verification.</p>
    <h2>How we use it</h2><p>Only to process orders, provide support and send order updates. If you join the newsletter, we use your email for shop news.</p>
    <h2>Your data</h2><p>We never sell your data. Payment screenshots are stored privately and visible only to you and the shop owner. We never collect or store card details. Contact us to correct or delete your information.</p>
  </Page>
)
export const Terms = () => (
  <Page eyebrow="policy" title="terms of service">
    <h2>Orders</h2><p>An order is confirmed once we accept it and, where applicable, verify payment. Prices are in Philippine pesos. We may cancel an order if an item cannot be fulfilled and will refund any verified payment.</p>
    <h2>Product photos</h2><p>Colors may vary slightly between screens and printed products.</p>
    <h2>Content</h2><p>All designs and images on this site belong to Bunini Loves and may not be reused without permission.</p>
  </Page>
)

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.string().trim().email('Enter a valid email'),
  message: z.string().trim().min(10, 'Tell us a little more (10+ characters)').max(4000),
  website: z.string().max(0).optional(), // honeypot: real people never fill this
})
type ContactForm = z.infer<typeof contactSchema>

export function Contact() {
  const opened = useRef(Date.now())
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContactForm>({ resolver: zodResolver(contactSchema) })

  const onSubmit = async (v: ContactForm) => {
    // Basic spam protection: honeypot + minimum time on page. (Add Turnstile/hCaptcha if spam grows.)
    if (v.website || Date.now() - opened.current < 3000) return setState({ ok: true, text: 'Thank you! We got your message ♡' })
    if (!isSupabaseConfigured) return setState({ ok: false, text: 'The store is not connected yet.' })
    const { error } = await supabase.from('contact_messages').insert({ name: v.name, email: v.email, message: v.message })
    if (error) return setState({ ok: false, text: 'Something went wrong. Please try again, or message us on Instagram.' })
    setState({ ok: true, text: "Thank you! We got your message and will reply soon ♡" }); reset()
  }

  return (
    <Page eyebrow="say hello" title="contact us">
      <p>Questions about an order or a product? Send us a note, or DM <a href="https://www.instagram.com/bunini_loves/" target="_blank" rel="noopener noreferrer">@bunini_loves</a>.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card grid gap-4 p-6">
        {state && <FormMessage kind={state.ok ? 'success' : 'error'}>{state.text}</FormMessage>}
        <Field label="Name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <div>
          <label htmlFor="msg" className="label">Message</label>
          <textarea id="msg" rows={5} className={`input ${errors.message ? 'input-error' : ''}`} aria-invalid={Boolean(errors.message)} {...register('message')} />
          {errors.message && <p role="alert" className="field-error">{errors.message.message}</p>}
        </div>
        <div className="absolute -left-[9999px]" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" {...register('website')} /></label></div>
        <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send message'}</button>
      </form>
    </Page>
  )
}