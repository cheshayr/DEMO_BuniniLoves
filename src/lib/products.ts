import { supabase } from './supabase'
import type { Category, EventRow, Product, ProductImage, ProductRating, ProductVariant, PublicReview } from './types'

export const PAGE_SIZE = 12

/** Nav groups that span several categories. None in the demo: Stationery is a real category here. */
export const CATEGORY_GROUPS: Record<string, { name: string; slugs: string[] }> = {}

export type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'popular'

export interface CatalogQuery {
  q?: string
  categorySlugs?: string[]
  minPrice?: number // pesos
  maxPrice?: number // pesos
  inStockOnly?: boolean
  tag?: string
  filter?: 'new' | 'sale' | 'best' | 'featured' | 'bundle'
  sort?: SortKey
  page?: number
}

async function attachImages(rows: Omit<Product, 'images'>[]): Promise<Product[]> {
  if (!rows.length) return []
  const { data } = await supabase.from('product_images').select('*').in('product_id', rows.map((r) => r.id)).order('sort_order')
  const byProduct = new Map<string, ProductImage[]>()
  ;(data as ProductImage[] | null)?.forEach((img) => {
    byProduct.set(img.product_id, [...(byProduct.get(img.product_id) ?? []), img])
  })
  return rows.map((r) => ({ ...r, images: byProduct.get(r.id) ?? [] }))
}

/** Strip characters that have meaning in PostgREST filter syntax. */
const safeTerm = (s: string) => s.replace(/[%,()*\\]/g, ' ').trim()

export async function fetchCatalog(opts: CatalogQuery): Promise<{ products: Product[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1)
  let query = supabase.from('catalog_products').select('*', { count: 'exact' }).eq('status', 'published')

  if (opts.q && safeTerm(opts.q)) {
    const t = safeTerm(opts.q)
    query = query.or(`name.ilike.%${t}%,description.ilike.%${t}%`)
  }
  if (opts.categorySlugs?.length) query = query.in('category_slug', opts.categorySlugs)
  if (opts.minPrice != null) query = query.gte('price_centavos', Math.round(opts.minPrice * 100))
  if (opts.maxPrice != null) query = query.lte('price_centavos', Math.round(opts.maxPrice * 100))
  if (opts.inStockOnly) query = query.gt('total_stock', 0)
  if (opts.tag) query = query.contains('tags', [opts.tag.toLowerCase()])
  if (opts.filter === 'new') query = query.eq('is_new_arrival', true)
  if (opts.filter === 'best') query = query.eq('is_best_seller', true)
  if (opts.filter === 'featured') query = query.eq('is_featured', true)
  if (opts.filter === 'bundle') query = query.eq('is_bundle', true)
  if (opts.filter === 'sale') query = query.not('sale_price_centavos', 'is', null)

  switch (opts.sort) {
    case 'price-asc': query = query.order('price_centavos', { ascending: true }); break
    case 'price-desc': query = query.order('price_centavos', { ascending: false }); break
    case 'popular': query = query.order('sold_count', { ascending: false }); break
    default: query = query.order('created_at', { ascending: false })
  }

  const from = (page - 1) * PAGE_SIZE
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)
  if (error) throw error
  return { products: await attachImages((data ?? []) as Omit<Product, 'images'>[]), total: count ?? 0 }
}

export async function fetchHomeProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('catalog_products').select('*').eq('status', 'published').eq('is_featured', true).order('created_at', { ascending: false }).limit(8)
  if (error) throw error
  return attachImages((data ?? []) as Omit<Product, 'images'>[])
}

/** Published products by id, in the order given (used for the owner's pinned picks). */
export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return []
  const { data, error } = await supabase.from('catalog_products').select('*').in('id', ids).eq('status', 'published')
  if (error) throw error
  const rows = await attachImages((data ?? []) as Omit<Product, 'images'>[])
  const order = new Map(ids.map((id, i) => [id, i]))
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

/** Approved reviews by id, in the order given (used for the owner's pinned reviews). */
export async function fetchReviewsByIds(ids: string[]): Promise<PublicReview[]> {
  if (!ids.length) return []
  const { data } = await supabase.from('public_reviews').select('*').in('id', ids)
  const order = new Map(ids.map((id, i) => [id, i]))
  return ((data ?? []) as PublicReview[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

export async function fetchProduct(slug: string) {
  const { data, error } = await supabase.from('catalog_products').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()
  if (error) throw error
  if (!data) return null
  const [withImages] = await attachImages([data as Omit<Product, 'images'>])
  const [{ data: variants }, { data: rating }, { data: reviews }] = await Promise.all([
    supabase.from('product_variants').select('*').eq('product_id', data.id).eq('is_active', true).order('sort_order'),
    supabase.from('product_ratings').select('*').eq('product_id', data.id).maybeSingle(),
    supabase.from('public_reviews').select('*').eq('product_id', data.id).order('created_at', { ascending: false }).limit(20),
  ])
  return {
    product: withImages,
    variants: (variants ?? []) as ProductVariant[],
    rating: (rating as ProductRating | null) ?? null,
    reviews: (reviews ?? []) as PublicReview[],
  }
}

export async function fetchRelated(product: Product, limit = 4): Promise<Product[]> {
  let q = supabase.from('catalog_products').select('*').eq('status', 'published').neq('id', product.id).limit(limit)
  if (product.category_slug) q = q.eq('category_slug', product.category_slug)
  const { data } = await q.order('sold_count', { ascending: false })
  return attachImages((data ?? []) as Omit<Product, 'images'>[])
}

/** "Frequently bought together": other products that appear in the same orders. Falls back to best sellers. */
export async function fetchBoughtTogether(product: Product, limit = 3): Promise<Product[]> {
  const { data } = await supabase.from('catalog_products').select('*').eq('status', 'published').neq('id', product.id).gt('total_stock', 0)
    .order('is_best_seller', { ascending: false }).order('sold_count', { ascending: false }).limit(limit)
  return attachImages((data ?? []) as Omit<Product, 'images'>[])
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function fetchUpcomingEvents(limit = 3): Promise<EventRow[]> {
  const { data } = await supabase.from('events').select('*').eq('status', 'published')
    .gte('ends_at', new Date().toISOString()).order('starts_at').limit(limit)
  return (data ?? []) as EventRow[]
}

export async function fetchTopReviews(limit = 6): Promise<(PublicReview & { product_name?: string })[]> {
  const { data } = await supabase.from('public_reviews').select('*').gte('rating', 4).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as PublicReview[]
}

export const reviewPhotoUrl = (path: string | null) =>
  path ? supabase.storage.from('review-photos').getPublicUrl(path).data.publicUrl : null