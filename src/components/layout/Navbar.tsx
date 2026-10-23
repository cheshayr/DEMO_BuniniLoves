import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { CurrencySelect } from '@/components/ui/Money'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'

export const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop All' },
  { to: '/shop?filter=new', label: 'New Arrivals' },
  { to: '/shop/stickers', label: 'Stickers' },
  { to: '/shop/stationery', label: 'Stationery' },
  { to: '/shop/notebooks', label: 'Notebooks' },
  { to: '/events', label: 'Events & Bazaar' },
  { to: '/about', label: 'About Us' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const { user, isAdmin } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setSearching(false) } }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    setSearching(false); setOpen(false)
    navigate(`/shop?q=${encodeURIComponent(q.trim())}`)
  }

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-2 font-display text-sm font-medium transition ${isActive ? 'bg-star text-ink-950' : 'text-milk/75 hover:text-bun-ribbon'}`

  return (
    <header className="sticky top-0 z-40 glass-bar">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
          {NAV_LINKS.map((l) => <NavLink key={l.label} to={l.to} end={l.end} className={linkCls}>{l.label}</NavLink>)}
        </nav>

        <div className="flex items-center gap-1">
          <CurrencySelect className="mr-1" />
          <button onClick={() => setSearching((s) => !s)} aria-label="Search" className="grid h-10 w-10 place-items-center rounded-full text-milk/80 transition hover:bg-ink-950/10 hover:text-bun-ribbon">
            <Search className="h-5 w-5" />
          </button>
          <Link to={user ? '/account' : '/login'} aria-label={user ? 'My account' : 'Sign in'} className="hidden h-10 w-10 place-items-center rounded-full text-milk/80 transition hover:bg-ink-950/10 hover:text-bun-ribbon sm:grid">
            <User className="h-5 w-5" />
          </Link>
          {isAdmin && <Link to="/admin" className="btn-ghost btn-sm ml-1 hidden sm:inline-flex">Admin</Link>}
          <Link to="/cart" aria-label={`Cart, ${count} items`} className="relative grid h-10 w-10 place-items-center rounded-full text-milk/80 transition hover:bg-ink-950/10 hover:text-bun-ribbon">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-star px-1 font-display text-[11px] font-bold text-ink-950">
                {count}
              </motion.span>
            )}
          </Link>
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-full text-milk/80 hover:bg-ink-950/10 xl:hidden">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {searching && (
          <motion.form onSubmit={submitSearch} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t-2 border-ink-950" role="search">
            <div className="container-x py-3">
              <label htmlFor="site-search" className="sr-only">Search products</label>
              <input id="site-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="search stickers, notebooks, stationery…" className="input" />
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Mobile drawer: thumb-reachable, anchored to the bottom */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm xl:hidden" />
            <motion.aside
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              role="dialog" aria-modal="true" aria-label="Menu"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-4xl border-t-2 border-ink-950 bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] xl:hidden"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink-950/20" />
              <div className="mb-3 flex items-center justify-between">
                <span className="eyebrow">menu</span>
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full bg-ink-950/10"><X className="h-5 w-5" /></button>
              </div>
              <nav aria-label="Mobile" className="grid gap-1">
                {NAV_LINKS.map((l) => (
                  <NavLink key={l.label} to={l.to} end={l.end} onClick={() => setOpen(false)}
                    className={({ isActive }) => `rounded-2xl px-4 py-3.5 font-display text-lg font-medium ${isActive ? 'bg-star text-ink-950' : 'text-milk hover:bg-ink-950/5'}`}>
                    {l.label}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link to={user ? '/account' : '/login'} onClick={() => setOpen(false)} className="btn-primary">{user ? 'My account' : 'Sign in / Register'}</Link>
                {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="btn-ghost">Admin dashboard</Link>}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}