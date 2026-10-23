export interface Category {
  id: string
  slug: string
  name: string
  description: string | null
  image_url: string | null
  sort_order: number
}

export interface ProductImage { id: string; product_id: string; url: string; alt: string | null; sort_order: number }

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  price_centavos: number | null
  stock: number
  low_stock_threshold: number
  sort_order: number
  is_active: boolean
}

/** Row from the catalog_products view. */
export interface Product {
  id: string
  slug: string
  name: string
  description: string
  specs: string | null
  care_instructions: string | null
  category_id: string | null
  category_slug: string | null
  category_name: string | null
  tags: string[]
  price_centavos: number
  sale_price_centavos: number | null
  stock: number
  total_stock: number
  has_variants: boolean
  low_stock_threshold: number
  is_featured: boolean
  is_new_arrival: boolean
  is_best_seller: boolean
  is_bundle: boolean
  is_limited_edition: boolean
  sold_count: number
  created_at: string
  images: ProductImage[]
}

export interface ProductRating { product_id: string; avg_rating: number; review_count: number }

export interface PublicReview {
  id: string
  product_id: string
  rating: number
  body: string
  photo_path: string | null
  admin_reply: string | null
  created_at: string
  reviewer_name: string
  verified_purchase: boolean
}

export interface EventRow {
  id: string
  slug: string
  name: string
  starts_at: string
  ends_at: string
  venue: string
  address: string | null
  description: string
  booth: string | null
  poster_url: string | null
}

export type StockState = 'in' | 'low' | 'out'
export const stockState = (p: Pick<Product, 'total_stock' | 'low_stock_threshold'>): StockState =>
  p.total_stock <= 0 ? 'out' : p.total_stock <= p.low_stock_threshold ? 'low' : 'in'

export const effectivePrice = (p: Pick<Product, 'price_centavos' | 'sale_price_centavos'>) => p.sale_price_centavos ?? p.price_centavos
