import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnnouncementBar } from './AnnouncementBar'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { MobileTabBar } from './MobileTabBar'
import { DemoBanner } from './DemoBanner'

export function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return (
    <div className="flex min-h-dvh flex-col">
      <button type="button" onClick={() => document.getElementById("main")?.focus()} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-star focus:px-4 focus:py-2 focus:text-ink-950">Skip to content</button>
      <DemoBanner />
      <AnnouncementBar />
      <Navbar />
      <main id="main" tabIndex={-1} className="flex-1 outline-none"><Outlet /></main>
      <Footer />
      <MobileTabBar />
    </div>
  )
}
