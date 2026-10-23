/** Philippine administrative regions (for the checkout address form). Province/city/barangay are free-text so any address can be entered. */
export const PH_REGIONS = [
  'NCR – National Capital Region',
  'CAR – Cordillera Administrative Region',
  'Region I – Ilocos Region',
  'Region II – Cagayan Valley',
  'Region III – Central Luzon',
  'Region IV-A – CALABARZON',
  'MIMAROPA Region',
  'Region V – Bicol Region',
  'Region VI – Western Visayas',
  'Region VII – Central Visayas',
  'Region VIII – Eastern Visayas',
  'Region IX – Zamboanga Peninsula',
  'Region X – Northern Mindanao',
  'Region XI – Davao Region',
  'Region XII – SOCCSKSARGEN',
  'Region XIII – Caraga',
  'BARMM – Bangsamoro Autonomous Region',
] as const

/** Accepts 09XXXXXXXXX or +639XXXXXXXXX; returns the 09 form. */
export const normalizePhone = (v: string) => v.replace(/[\s-]/g, '').replace(/^\+63/, '0')
