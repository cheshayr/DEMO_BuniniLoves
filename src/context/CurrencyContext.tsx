import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useSettings } from '@/context/SettingsContext'
import { approxLabel, currencyOptions } from '@/lib/currency'
import { formatPHP } from '@/lib/format'

const KEY = 'bl_currency'
const read = () => { try { return localStorage.getItem(KEY) || 'PHP' } catch { return 'PHP' } }

interface CurrencyState {
  /** Currency the shopper picked (always PHP when conversion is off). */
  code: string
  options: string[]
  /** True when the owner enabled conversion and at least one rate is set. */
  enabled: boolean
  setCode: (code: string) => void
  /** Price shown while browsing: converted estimate if another currency is selected, else PHP. */
  browse: (centavos: number) => string
  /** "≈ $1.72" next to an amount that is charged in PHP; null when PHP is selected. */
  approx: (centavos: number) => string | null
}

const Ctx = createContext<CurrencyState>({ code: 'PHP', options: ['PHP'], enabled: false, setCode: () => {}, browse: formatPHP, approx: () => null })

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { site } = useSettings()
  const [picked, setPicked] = useState(read)
  const { enabled: on, rates } = site.currency
  const options = useMemo(() => currencyOptions(rates), [rates])
  const enabled = on && options.length > 1
  const code = enabled && options.includes(picked) ? picked : 'PHP'

  const setCode = useCallback((c: string) => { setPicked(c); try { localStorage.setItem(KEY, c) } catch { /* private mode: selection just won't persist */ } }, [])
  const approx = useCallback((centavos: number) => (enabled ? approxLabel(centavos, code, rates) : null), [enabled, code, rates])
  const browse = useCallback((centavos: number) => approx(centavos) ?? formatPHP(centavos), [approx])

  const value = useMemo(() => ({ code, options, enabled, setCode, browse, approx }), [code, options, enabled, setCode, browse, approx])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useCurrency = () => useContext(Ctx)
