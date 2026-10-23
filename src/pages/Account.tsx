import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, MailWarning } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export default function Account() {
  const { user, verified, isAdmin, signOut } = useAuth()
  const [sent, setSent] = useState(false)

  const resend = async () => {
    if (!user?.email) return
    await supabase.auth.resend({ type: 'signup', email: user.email })
    setSent(true)
  }

  return (
    <section className="container-x max-w-3xl py-12">
      <p className="eyebrow">my account</p>
      <h1 className="mt-1 text-4xl font-semibold">hi, {(user?.user_metadata?.full_name as string)?.split(' ')[0] || 'friend'} ♡</h1>

      <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          {verified ? <BadgeCheck className="h-6 w-6 text-bun-ribbon" /> : <MailWarning className="h-6 w-6 text-bun-ribbon" />}
          <div>
            <p className="font-display font-semibold">{user?.email}</p>
            <p className="text-sm text-milk/60">{verified ? 'Email verified' : 'Email not verified. You must verify before checkout.'}</p>
          </div>
        </div>
        {!verified && <button onClick={resend} disabled={sent} className="btn-pink btn-sm">{sent ? 'Sent!' : 'Resend link'}</button>}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/account/orders" className="btn-primary">My orders</Link>
        <Link to="/account/reviews" className="btn-ghost">My reviews</Link>
        <Link to="/wishlist" className="btn-ghost">Wishlist</Link>
        {isAdmin && <Link to="/admin" className="btn-pink">Open admin</Link>}
        <button onClick={signOut} className="btn-ghost">Sign out</button>
      </div>
    </section>
  )
}
