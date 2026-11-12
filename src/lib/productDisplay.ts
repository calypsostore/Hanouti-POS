import type { Product } from '../types'

export function getProductImage(product: Product) {
  if ('image' in product && typeof product.image === 'string') return product.image
  if ('imageUrl' in product && typeof product.imageUrl === 'string') return product.imageUrl
  return undefined
}
