import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'

interface WishlistState {
  ids: Set<string>
  has: (productId: string) => boolean
  /** Saves to the database for signed-in customers; otherwise sends the visitor to sign in. */
  toggle: (productId: string) => Promise<void>
}

const Ctx = createContext<WishlistState | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) { setIds(new Set()); return }
    supabase.from('wishlist_items').select('product_id').then(({ data }) => {
      setIds(new Set((data ?? []).map((r: { product_id: string }) => r.product_id)))
    })
  }, [user])

  const toggle = useCallback(async (productId: string) => {
    if (!user) { navigate('/login', { state: { from: (window.location.hash.replace(/^#/, '') || '/') } }); return }
    const had = ids.has(productId)
    // optimistic update, rolled back if the database rejects it
    setIds((prev) => { const n = new Set(prev); had ? n.delete(productId) : n.add(productId); return n })
    const { error } = had
      ? await supabase.from('wishlist_items').delete().eq('product_id', productId).eq('user_id', user.id)
      : await supabase.from('wishlist_items').insert({ product_id: productId, user_id: user.id })
    if (error) setIds((prev) => { const n = new Set(prev); had ? n.add(productId) : n.delete(productId); return n })
  }, [user, ids, navigate])

  const value = useMemo<WishlistState>(() => ({ ids, has: (id) => ids.has(id), toggle }), [ids, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWishlist() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWishlist must be used inside <WishlistProvider>')
  return v
}
