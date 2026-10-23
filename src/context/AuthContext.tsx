import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@/lib/supabase'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

type Role = 'customer' | 'admin'

interface AuthState {
  user: User | null
  session: Session | null
  role: Role | null
  loading: boolean
  /** Email verified: required for account-sensitive actions such as checkout. */
  verified: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  refreshRole: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const loadRole = useCallback(async (uid: string | undefined) => {
    if (!uid) return setRole(null)
    // Server-enforced by RLS: a user can only ever read their own role row.
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', uid).maybeSingle()
    setRole((data?.role as Role) ?? 'customer')
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadRole(data.session?.user.id).finally(() => setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      // defer to avoid deadlocking inside the auth callback
      setTimeout(() => loadRole(s?.user.id), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadRole])

  const value = useMemo<AuthState>(() => ({
    user: session?.user ?? null,
    session,
    role,
    loading,
    verified: Boolean(session?.user.email_confirmed_at),
    // UI convenience only. Real enforcement is RLS + security-definer functions.
    isAdmin: role === 'admin',
    signOut: async () => { await supabase.auth.signOut() },
    refreshRole: () => loadRole(session?.user.id),
  }), [session, role, loading, loadRole])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}
