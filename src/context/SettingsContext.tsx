import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { DEFAULT_SITE, fetchSiteSettings } from '@/lib/site'
import type { SiteSettings } from '@/lib/site'

export interface Announcement { enabled: boolean; text: string; link?: string }
interface SettingsState {
  announcement: Announcement | null
  /** Owner-editable homepage text, socials, pinned items and currency rates (always has safe defaults). */
  site: SiteSettings
  /** False until the first read finishes, so the homepage can fade in instead of flashing default text. */
  loaded: boolean
  /** Re-reads public settings (used after the owner saves them). */
  refresh: () => void
}

const Ctx = createContext<SettingsState>({ announcement: null, site: DEFAULT_SITE, loaded: true, refresh: () => {} })

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [site, setSite] = useState<SiteSettings>(DEFAULT_SITE)
  const [loaded, setLoaded] = useState(!isSupabaseConfigured)

  const refresh = useCallback(() => {
    if (!isSupabaseConfigured) return
    supabase.from('store_settings').select('value').eq('key', 'announcement').maybeSingle()
      .then(({ data }) => setAnnouncement((data?.value as Announcement) ?? null))
    fetchSiteSettings().then(setSite).finally(() => setLoaded(true))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return <Ctx.Provider value={{ announcement, site, loaded, refresh }}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
