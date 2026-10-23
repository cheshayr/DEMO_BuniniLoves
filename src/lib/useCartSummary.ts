import { useCallback, useEffect, useState } from 'react'
import { useCart } from '@/context/CartContext'
import { previewDiscount } from './checkout'
import { areaForRegion, DEFAULT_COURIERS, fetchCourierSettings, shippingCost, type CourierSettings } from './shipping'

const CODE_KEY = 'bl_discount_code'
const read = () => { try { return sessionStorage.getItem(CODE_KEY) ?? '' } catch { return '' } }
const write = (v: string) => { try { v ? sessionStorage.setItem(CODE_KEY, v) : sessionStorage.removeItem(CODE_KEY) } catch { /* ignore */ } }

/**
 * Shared by the cart and checkout: subtotal, discount (previewed server-side), shipping and total.
 * Shipping is null until the customer has chosen a delivery region and an available courier.
 */
export function useCartSummary(opts: { region?: string; courierId?: string | null } = {}) {
  const { subtotalCentavos } = useCart()
  const [couriers, setCouriers] = useState<CourierSettings>(DEFAULT_COURIERS)
  const [couriersLoaded, setCouriersLoaded] = useState(false)
  const [code, setCode] = useState(read)
  const [discount, setDiscount] = useState(0)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchCourierSettings().then(setCouriers).catch(() => undefined).finally(() => setCouriersLoaded(true)) }, [])

  const check = useCallback(async (c: string, subtotal: number, announce: boolean) => {
    if (!c) { setDiscount(0); return }
    setBusy(true)
    const r = await previewDiscount(c, subtotal)
    setBusy(false)
    setDiscount(r.valid ? r.discount : 0)
    if (!r.valid) { setCode(''); write('') }
    if (announce || !r.valid) setMessage({ ok: r.valid, text: r.message })
  }, [])

  // re-check a saved code whenever the subtotal changes (min-spend rules, quantity edits)
  useEffect(() => { if (code) void check(code, subtotalCentavos, false); else setDiscount(0) }, [subtotalCentavos]) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async (raw: string) => {
    const c = raw.trim().toUpperCase()
    if (!c) return
    setCode(c); write(c)
    await check(c, subtotalCentavos, true)
  }
  const remove = () => { setCode(''); write(''); setDiscount(0); setMessage(null) }

  const area = areaForRegion(opts.region)
  const courier = couriers.couriers.find((c) => c.id === opts.courierId && c.available) ?? null
  const shipping: number | null = subtotalCentavos > 0 && area && courier ? shippingCost(couriers, courier, area, subtotalCentavos - discount) : null
  return {
    subtotal: subtotalCentavos, discount, shipping, total: Math.max(0, subtotalCentavos - discount + (shipping ?? 0)),
    code, apply, remove, message, busy, couriers, couriersLoaded, area, courier,
  }
}
