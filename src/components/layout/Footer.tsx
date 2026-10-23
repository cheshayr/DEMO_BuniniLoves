import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Facebook, Globe, Instagram, Mail, Youtube } from 'lucide-react'
import type { ComponentType } from 'react'
import { useSettings } from '@/context/SettingsContext'
import { Logo } from '@/components/ui/Logo'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { emailSchema } from '@/lib/validation'

const SOCIAL_LINKS: { key: 'instagram' | 'facebook' | 'youtube' | 'website' | 'tiktok' | 'shopee' | 'lazada'; label: string; icon?: ComponentType<{ className?: string }> }[] = [
  { key: 'instagram', label: 'Instagram', icon: Instagram }, { key: 'facebook', label: 'Facebook', icon: Facebook }, { key: 'youtube', label: 'YouTube', icon: Youtube },
  { key: 'tiktok', label: 'TikTok' }, { key: 'shopee', label: 'Shopee' }, { key: 'lazada', label: 'Lazada' }, { key: 'website', label: 'Website', icon: Globe },
]

export function Footer() {
  const { site } = useSettings()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = emailSchema.safeParse({ email })
    if (!parsed.success) return setMsg({ ok: false, text: 'Please enter a valid email.' })
    if (!isSupabaseConfigured) return setMsg({ ok: false, text: 'Store is not connected yet.' })
    setBusy(true)
    const { error } = await supabase.from('newsletter_subscribers').insert({ email: parsed.data.email.toLowerCase() })
    setBusy(false)
    if (error && error.code !== '23505') return setMsg({ ok: false, text: 'Something went wrong. Please try again.' })
    setMsg({ ok: true, text: "you're on the list ♡" }); setEmail('')
  }

  const col = 'grid content-start gap-2 text-sm text-milk/65'
  return (
    <footer className="mt-24 border-t-2 border-ink-950 bg-white pb-28 pt-14 lg:pb-14">
      <div className="container-x grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-milk/60">Little things, lots of love. Stickers, stationery and paper goods made to brighten your desk.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SOCIAL_LINKS.filter((s) => site.socials[s.key]).map(({ key, label, icon: Icon }) => (
              <a key={key} href={site.socials[key]} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}
                className={`grid h-10 place-items-center rounded-full bg-ink-950/[.06] transition hover:bg-star hover:text-ink-950 ${Icon ? 'w-10' : 'px-4 font-display text-sm font-semibold'}`}>
                {Icon ? <Icon className="h-5 w-5" /> : label}
              </a>
            ))}
            <Link to="/contact" aria-label="Contact" className="grid h-10 w-10 place-items-center rounded-full bg-ink-950/[.06] transition hover:bg-star hover:text-ink-950"><Mail className="h-5 w-5" /></Link>
          </div>
        </div>
        <nav className={col} aria-label="Shop"><h3 className="mb-1 font-display text-base text-milk">shop</h3>
          <Link to="/shop" className="hover:text-bun-ribbon">Shop all</Link><Link to="/shop?filter=new" className="hover:text-bun-ribbon">New arrivals</Link>
          <Link to="/shop/stickers" className="hover:text-bun-ribbon">Stickers</Link><Link to="/events" className="hover:text-bun-ribbon">Events & bazaar</Link><Link to="/news" className="hover:text-bun-ribbon">News & updates</Link>
        </nav>
        <nav className={col} aria-label="Help"><h3 className="mb-1 font-display text-base text-milk">help</h3>
          <Link to="/faq" className="hover:text-bun-ribbon">FAQs</Link><Link to="/shipping" className="hover:text-bun-ribbon">Shipping policy</Link>
          <Link to="/returns" className="hover:text-bun-ribbon">Return policy</Link><Link to="/privacy" className="hover:text-bun-ribbon">Privacy policy</Link>
          <Link to="/terms" className="hover:text-bun-ribbon">Terms of service</Link><Link to="/contact" className="hover:text-bun-ribbon">Contact us</Link>
        </nav>
        <form onSubmit={subscribe} noValidate>
          <h3 className="mb-1 font-display text-base">little letters</h3>
          <p className="mb-3 text-sm text-milk/60">Restocks and bazaar news. No spam, promise.</p>
          <label htmlFor="nl" className="sr-only">Email address</label>
          <div className="flex gap-2">
            <input id="nl" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="input min-w-0" />
            <button className="btn-primary shrink-0" disabled={busy}>{busy ? '…' : 'Join'}</button>
          </div>
          {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? 'text-bun-ribbon' : 'text-bun-ribbon'}`}>{msg.text}</p>}
        </form>
      </div>
      <p className="container-x mt-12 text-xs text-milk/40">© {new Date().getFullYear()} bunini loves. Made with love in the Philippines.</p>
    </footer>
  )
}
