import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Cart lines are stored on-device (localStorage) so guests can shop.
 * Display fields are a convenience snapshot only: at checkout (Phase 3) the server re-reads
 * current prices and stock and rejects anything stale, so a tampered cart can't change what is charged.
 * Phase 3 also syncs these lines to the cart_items table for signed-in customers.
 */
export interface CartLine {
  productId: string
  variantId: string | null
  slug: string
  name: string
  variantName: string | null
  unitPriceCentavos: number
  image: string | null
  quantity: number
  /** Stock known when the item was added; used to cap quantities in the UI. */
  maxQuantity: number
}

interface CartState {
  lines: CartLine[]
  count: number
  subtotalCentavos: number
  /** Returns how many units were actually added (0 when sold out or at the cap). */
  add: (line: Omit<CartLine, 'quantity'>, qty?: number) => number
  setQuantity: (productId: string, variantId: string | null, qty: number) => void
  remove: (productId: string, variantId: string | null) => void
  /** Replace all lines (used after re-validating prices and stock against the database). */
  replaceLines: (lines: CartLine[]) => void
  clear: () => void
}

const KEY = 'bl_cart_v1'
const Ctx = createContext<CartState | null>(null)
const same = (l: CartLine, p: string, v: string | null) => l.productId === p && l.variantId === v

function load(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((l) => l && typeof l.productId === 'string' && l.quantity > 0) : []
  } catch { return [] }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)) } catch { /* storage unavailable: cart lives in memory */ }
  }, [lines])

  const add = useCallback<CartState['add']>((line, qty = 1) => {
    const cap = Math.max(0, Math.min(line.maxQuantity, 99))
    const current = lines.find((l) => same(l, line.productId, line.variantId))?.quantity ?? 0
    const next = Math.min(cap, current + qty)
    const added = next - current
    if (added <= 0) return 0
    setLines((prev) => {
      const existing = prev.find((l) => same(l, line.productId, line.variantId))
      if (existing) return prev.map((l) => (l === existing ? { ...l, ...line, quantity: next } : l))
      return [...prev, { ...line, quantity: next }]
    })
    return added
  }, [lines])

  const setQuantity = useCallback<CartState['setQuantity']>((p, v, qty) => {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (!same(l, p, v)) return [l]
        if (qty <= 0) return []
        return [{ ...l, quantity: Math.min(qty, l.maxQuantity, 99) }]
      }),
    )
  }, [])

  const remove = useCallback<CartState['remove']>((p, v) => setLines((prev) => prev.filter((l) => !same(l, p, v))), [])
  const clear = useCallback(() => setLines([]), [])
  const replaceLines = useCallback((next: CartLine[]) => setLines(next), [])

  const value = useMemo<CartState>(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalCentavos: lines.reduce((n, l) => n + l.quantity * l.unitPriceCentavos, 0),
    add, setQuantity, remove, replaceLines, clear,
  }), [lines, add, setQuantity, remove, replaceLines, clear])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCart must be used inside <CartProvider>')
  return v
}
