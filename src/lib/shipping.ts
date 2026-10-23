import { supabase } from './supabase'

/** Delivery areas. The customer's region decides which fee of a courier applies. */
export type Area = 'metro_manila' | 'luzon' | 'visayas' | 'mindanao'
export const AREAS: { id: Area; label: string; hint: string }[] = [
  { id: 'metro_manila', label: 'Metro Manila', hint: 'NCR' },
  { id: 'luzon', label: 'Outside Metro Manila', hint: 'Rest of Luzon' },
  { id: 'visayas', label: 'Visayas', hint: 'Regions VI, VII, VIII' },
  { id: 'mindanao', label: 'Mindanao', hint: 'Regions IX to XIII and BARMM' },
]
export const AREA_LABEL: Record<Area, string> = Object.fromEntries(AREAS.map((a) => [a.id, a.label])) as Record<Area, string>

const REGION_AREA: Record<string, Area> = {
  NCR: 'metro_manila',
  CAR: 'luzon', 'Region I': 'luzon', 'Region II': 'luzon', 'Region III': 'luzon', 'Region IV-A': 'luzon', MIMAROPA: 'luzon', 'Region V': 'luzon',
  'Region VI': 'visayas', 'Region VII': 'visayas', 'Region VIII': 'visayas',
  'Region IX': 'mindanao', 'Region X': 'mindanao', 'Region XI': 'mindanao', 'Region XII': 'mindanao', 'Region XIII': 'mindanao', BARMM: 'mindanao',
}
/** "Region VII – Central Visayas" -> 'visayas'. Returns null for an unknown or empty region. */
export const areaForRegion = (region: string | null | undefined): Area | null => REGION_AREA[String(region ?? '').split(' – ')[0].trim()] ?? null

export interface Courier {
  id: string
  name: string
  /** false = temporarily unavailable: shown crossed out at checkout and cannot be chosen. */
  available: boolean
  estimate: string
  /** Fee in centavos for each area. */
  rates: Record<Area, number>
}
export interface CourierSettings { free_over_centavos: number | null; couriers: Courier[] }
export const DEFAULT_COURIERS: CourierSettings = { free_over_centavos: null, couriers: [] }

const rate = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0)

/** Tolerates missing or odd data so one bad value never breaks the checkout. */
export function normalizeCouriers(raw: unknown): CourierSettings {
  const r = (raw ?? {}) as { free_over_centavos?: unknown; couriers?: unknown }
  const list = Array.isArray(r.couriers) ? r.couriers : []
  return {
    free_over_centavos: r.free_over_centavos == null || r.free_over_centavos === '' ? null : rate(r.free_over_centavos),
    couriers: list
      .filter((c): c is Record<string, any> => !!c && typeof c === 'object' && typeof c.id === 'string')
      .map((c) => ({
        id: c.id, name: String(c.name ?? 'Courier'), available: c.available !== false, estimate: String(c.estimate ?? ''),
        rates: { metro_manila: rate(c.rates?.metro_manila), luzon: rate(c.rates?.luzon), visayas: rate(c.rates?.visayas), mindanao: rate(c.rates?.mindanao) },
      })),
  }
}

export async function fetchCourierSettings(): Promise<CourierSettings> {
  const { data } = await supabase.from('store_settings').select('value').eq('key', 'couriers').maybeSingle()
  return normalizeCouriers(data?.value)
}

export async function saveCourierSettings(s: CourierSettings): Promise<void> {
  const { error } = await supabase.from('store_settings').upsert({ key: 'couriers', value: s, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(error.message || 'Could not save. Please try again.')
}

/** Shipping fee in centavos: free above the threshold, otherwise the courier's fee for that area. */
export function shippingCost(s: CourierSettings, courier: Courier, area: Area, subtotalAfterDiscount: number): number {
  if (s.free_over_centavos != null && subtotalAfterDiscount >= s.free_over_centavos) return 0
  return courier.rates[area]
}

export const newCourierId = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'courier'}-${Math.random().toString(36).slice(2, 6)}`
