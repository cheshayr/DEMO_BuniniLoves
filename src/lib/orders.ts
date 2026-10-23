import { supabase } from './supabase'

export type OrderStatus = 'pending' | 'awaiting_payment' | 'payment_verification' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type PaymentStatus = 'unpaid' | 'submitted' | 'verified' | 'failed' | 'refunded'
export type PaymentMethod = 'gcash' | 'maya' | 'bank_transfer' | 'cod' | 'card'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending', awaiting_payment: 'Awaiting payment', payment_verification: 'Payment verification', processing: 'Processing',
  packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
}
export const PAYMENT_LABEL: Record<PaymentStatus, string> = { unpaid: 'Unpaid', submitted: 'Proof submitted', verified: 'Paid', failed: 'Failed', refunded: 'Refunded' }
export const METHOD_LABEL: Record<PaymentMethod, string> = { gcash: 'GCash', maya: 'Maya', bank_transfer: 'Bank transfer', cod: 'Cash on delivery', card: 'Card' }

/** Happy-path steps shown in the timeline (cancelled/refunded are shown separately). */
export const TIMELINE: OrderStatus[] = ['pending', 'awaiting_payment', 'payment_verification', 'processing', 'packed', 'shipped', 'delivered']

export interface OrderRow {
  id: string
  order_number: string
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  subtotal_centavos: number
  discount_centavos: number
  shipping_centavos: number
  total_centavos: number
  discount_code: string | null
  ship_name: string; ship_phone: string; ship_email: string
  ship_region: string; ship_province: string; ship_city: string; ship_barangay: string
  ship_street: string; ship_postal_code: string; ship_landmark: string | null; delivery_notes: string | null
  courier: string | null
  tracking_number: string | null
  created_at: string
}
export interface OrderItemRow { id: string; product_id: string; product_name: string; variant_name: string | null; unit_price_centavos: number; quantity: number }
export interface HistoryRow { id: string; status: OrderStatus; note: string | null; created_at: string }
export interface PaymentRow { id: string; status: PaymentStatus; reference_number: string | null; proof_path: string | null; amount_centavos: number }

export async function fetchMyOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as OrderRow[]
}

export async function fetchOrder(id: string) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!order) return null
  const [items, history, payment] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', id),
    supabase.from('order_status_history').select('*').eq('order_id', id).order('created_at'),
    supabase.from('payments').select('*').eq('order_id', id).maybeSingle(),
  ])
  return {
    order: order as OrderRow,
    items: (items.data ?? []) as OrderItemRow[],
    history: (history.data ?? []) as HistoryRow[],
    payment: (payment.data ?? null) as PaymentRow | null,
  }
}

/** Server messages are written for customers (e.g. "Only 2 left of …"), so surface them directly. */
export const friendlyRpcError = (e: { message?: string } | null) => e?.message?.replace(/^.*?ERROR:\s*/, '') || 'Something went wrong. Please try again.'
