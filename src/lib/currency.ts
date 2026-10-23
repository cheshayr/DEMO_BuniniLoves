/**
 * Display-only currency conversion. Prices are always stored and CHARGED in PHP (integer centavos);
 * these helpers only show an estimate in the shopper's chosen currency using rates the owner sets.
 */
export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US dollar' }, { code: 'EUR', name: 'Euro' }, { code: 'GBP', name: 'British pound' }, { code: 'JPY', name: 'Japanese yen' },
  { code: 'AUD', name: 'Australian dollar' }, { code: 'CAD', name: 'Canadian dollar' }, { code: 'SGD', name: 'Singapore dollar' }, { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'KRW', name: 'South Korean won' }, { code: 'CNY', name: 'Chinese yuan' }, { code: 'TWD', name: 'New Taiwan dollar' }, { code: 'AED', name: 'UAE dirham' },
  { code: 'SAR', name: 'Saudi riyal' }, { code: 'MYR', name: 'Malaysian ringgit' }, { code: 'THB', name: 'Thai baht' }, { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'CHF', name: 'Swiss franc' },
]
const ORDER = new Map(CURRENCIES.map((c, i) => [c.code, i]))
export const currencyName = (code: string) => (code === 'PHP' ? 'Philippine peso' : CURRENCIES.find((c) => c.code === code)?.name ?? code)

/** Sorted list of currencies a shopper can pick: PHP first, then the ones the owner has set a rate for. */
export const currencyOptions = (rates: Record<string, number>): string[] =>
  ['PHP', ...Object.keys(rates).sort((a, b) => (ORDER.get(a) ?? 99) - (ORDER.get(b) ?? 99) || a.localeCompare(b))]

const cache = new Map<string, Intl.NumberFormat>()
export function formatMoney(amount: number, code: string): string {
  let f = cache.get(code)
  if (!f) { f = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }); cache.set(code, f) }
  return f.format(amount)
}

/** Converts integer PHP centavos to a major-unit amount in another currency (rate = units per 1 PHP). */
export const convertCentavos = (centavos: number, rate: number) => (centavos / 100) * rate

/** Parses an owner-typed rate like "0.0172"; returns null unless it is a positive, sensible number. */
export function parseRate(input: string): number | null {
  const s = input.trim().replace(/,/g, '')
  if (!/^\d*\.?\d+(e-?\d+)?$/i.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : null
}

/** "≈ $1.72" for the given currency, or null for PHP / unknown currency. */
export function approxLabel(centavos: number, code: string, rates: Record<string, number>): string | null {
  const rate = rates[code]
  if (code === 'PHP' || !rate) return null
  return `≈ ${formatMoney(convertCentavos(centavos, rate), code)}`
}
