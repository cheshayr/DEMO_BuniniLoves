import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isExternal } from '@/lib/site'

/** Internal paths use the router; owner-entered https links open safely in a new tab. */
export function SmartLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return isExternal(to)
    ? <a href={to} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link to={to} className={className}>{children}</Link>
}
