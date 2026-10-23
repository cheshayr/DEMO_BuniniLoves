import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

function Splash() {
  return <div className="grid min-h-[50dvh] place-items-center"><div className="skeleton h-10 w-40" aria-label="Loading" /></div>
}

/** Requires a signed-in user. (UI routing only — data access is enforced by RLS.) */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

/** Admin shell guard. Customers get a 404-style redirect; every admin query/RPC is independently protected server-side. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, role, loading } = useAuth()
  if (loading || (user && role === null)) return <Splash />
  if (!user) return <Navigate to="/login" replace state={{ from: '/admin' }} />
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}
