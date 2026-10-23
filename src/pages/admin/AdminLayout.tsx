import { Suspense, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, LayoutDashboard, Menu, MessageSquare, Package, ShoppingCart, Tag, Truck, Users, Warehouse, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { NotificationBell } from '@/components/admin/NotificationBell'
import { ListSkeleton, ToastProvider } from '@/components/admin/ui'

const ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/inventory', label: 'Inventory', icon: Warehouse },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/discounts', label: 'Discounts', icon: Tag },
  { to: '/admin/reviews', label: 'Reviews', icon: MessageSquare },
  { to: '/admin/community', label: 'News & events', icon: CalendarDays },
  { to: '/admin/shipping', label: 'Shipping', icon: Truck },
]

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const nav = (
    <nav aria-label="Admin" className="grid gap-1">
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 font-display text-[15px] font-medium transition ${isActive ? 'bg-star text-ink-950' : 'text-milk/75 hover:bg-ink-950/5'}`}>
          <Icon className="h-5 w-5" /> {label}
        </NavLink>
      ))}
    </nav>
  )
  return (
    <ToastProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r-2 border-ink-950 bg-white p-5 lg:flex">
          <div><Logo /><p className="eyebrow mt-2">owner studio</p></div>
          {nav}
          <Link to="/" className="btn-ghost btn-sm mt-auto">← View store</Link>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-ink-950 bg-ink-900/90 px-4 backdrop-blur-xl lg:px-8">
            <button onClick={() => setOpen(true)} aria-label="Open admin menu" className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink-950/10 lg:hidden"><Menu className="h-6 w-6" /></button>
            <span className="font-display text-lg font-semibold lg:hidden">studio</span>
            <span className="hidden font-display text-sm text-milk/50 lg:block">Admin</span>
            <NotificationBell />
          </header>
          <main className="p-4 lg:p-8"><Suspense fallback={<ListSkeleton rows={3} />}><Outlet /></Suspense></main>
        </div>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
            <div className="absolute inset-0 bg-ink-950/60" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r-2 border-ink-950 bg-white p-5">
              <div className="mb-5 flex items-center justify-between"><Logo /><button onClick={() => setOpen(false)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-ink-950/10"><X className="h-5 w-5" /></button></div>
              {nav}
              <Link to="/" onClick={() => setOpen(false)} className="btn-ghost btn-sm mt-6 w-full">← View store</Link>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
