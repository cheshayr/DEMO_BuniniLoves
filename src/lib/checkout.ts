import { supabase } from './supabase'
import type { CartLine } from '@/context/CartContext'
import type { PaymentMethod } from './orders'

export interface CartIssue { key: string; message: string }
export interface Revalidated { lines: CartLine[]; issues: CartIssue[] }

const lineKey = (l: Pick<CartLine, 'productId' | 'variantId'>) => `${l.productId}:${l.variantId ?? ''}`

/**
 * Re-reads current prices and stock from the database and corrects the local cart.
 * This is a UX safety net: place_order() independently re-checks everything on the server.
 */
export async function revalidateCart(lines: CartLine[]): Promise<Revalidated> {
  if (!lines.length) return { lines, issues: [] }
  const ids = [...new Set(lines.map((l) => l.productId))]
  const [{ data: products }, { data: variants }] = await Promise.all([
    supabase.from('catalog_products').select('id,slug,name,price_centavos,sale_price_centavos,stock,has_variants,status').in('id', ids),
    supabase.from('product_variants').select('id,product_id,name,price_centavos,stock,is_active').in('product_id', ids),
  ])
  const pMap = new Map((products ?? []).map((p: any) => [p.id as string, p]))
  const vMap = new Map((variants ?? []).map((v: any) => [v.id as string, v]))

  const out: CartLine[] = []
  const issues: CartIssue[] = []
  for (const l of lines) {
    const p: any = pMap.get(l.productId)
    if (!p || p.status !== 'published') { issues.push({ key: lineKey(l), message: `${l.name} is no longer available and was removed.` }); continue }
    let stock = p.stock as number
    let price = (p.sale_price_centavos ?? p.price_centavos) as number
    let variantName = l.variantName
    if (l.variantId) {
      const v: any = vMap.get(l.variantId)
      if (!v || !v.is_active) { issues.push({ key: lineKey(l), message: `That option of ${l.name} is no longer available and was removed.` }); continue }
      stock = v.stock; variantName = v.name; price = v.price_centavos ?? price
    } else if (p.has_variants) {
      issues.push({ key: lineKey(l), message: `${l.name} now needs an option to be chosen. Please re-add it.` }); continue
    }
    if (stock <= 0) { issues.push({ key: lineKey(l), message: `${l.name} just sold out and was removed.` }); continue }
    let quantity = l.quantity
    if (quantity > stock) { quantity = stock; issues.push({ key: lineKey(l), message: `Only ${stock} of ${l.name} left. We adjusted your quantity.` }) }
    if (price !== l.unitPriceCentavos) issues.push({ key: lineKey(l), message: `The price of ${l.name} changed. Your total has been updated.` })
    out.push({ ...l, name: p.name, slug: p.slug, variantName, unitPriceCentavos: price, maxQuantity: stock, quantity })
  }
  return { lines: out, issues }
}

export interface MethodConfig { enabled: boolean; instructions?: string; account_name?: string; account_number?: string; bank?: string }
export type PaymentConfig = Partial<Record<PaymentMethod, MethodConfig>>

export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  const { data } = await supabase.from('store_settings').select('value').eq('key', 'payment_methods').maybeSingle()
  return (data?.value as PaymentConfig) ?? {}
}

export async function previewDiscount(code: string, subtotal: number): Promise<{ valid: boolean; discount: number; message: string }> {
  const { data, error } = await supabase.rpc('validate_discount', { p_code: code, p_subtotal_centavos: subtotal })
  if (error || !data) return { valid: false, discount: 0, message: 'Could not check that code' }
  return { valid: Boolean(data.valid), discount: data.discount_centavos ?? 0, message: data.message ?? '' }
}
