import { NavLink } from 'react-router-dom'
import { CalendarDays, Home, ShoppingBag, Store, User } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'

/** One-handed bottom navigation, visible below the lg breakpoint. */
export function MobileTabBar() {
  const { count } = useCart()
  const { user } = useAuth()
  const items = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/shop', label: 'Shop', icon: Store },
    { to: '/events', label: 'Events', icon: CalendarDays },
    { to: user ? '/account' : '/login', label: 'Me', icon: User },
    { to: '/cart', label: 'Cart', icon: ShoppingBag, badge: count },
  ]
  return (
    <nav aria-label="Quick" className="fixed inset-x-3 bottom-3 z-30 flex justify-between rounded-full border-2 border-ink-950 bg-white px-2 py-1.5 shadow-card backdrop-blur-xl pb-[max(.375rem,env(safe-area-inset-bottom))] lg:hidden">
      {items.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink key={label} to={to} end={end}
          className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 font-display text-[11px] font-medium transition ${isActive ? 'bg-star text-ink-950' : 'text-milk/70'}`}>
          <Icon className="h-5 w-5" />
          {label}
          {!!badge && <span className="absolute right-3 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-bun-deep px-1 text-[10px] font-bold text-white">{badge}</span>}
        </NavLink>
      ))}
    </nav>
  )
}
