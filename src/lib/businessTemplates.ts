import type { BusinessType, PosMode, StoreFeatures } from '../types'
import { BRAND_NAME } from './brand'

const receiptFooter = (message: string) => `${message} · ${BRAND_NAME}`

export interface BusinessTemplate {
  posMode: PosMode
  features: StoreFeatures
  receiptFooter: string
  categories: Array<{ name: string; emoji: string }>
}

const templates: Record<BusinessType, BusinessTemplate> = {
  cafe: {
    posMode: 'cashier',
    features: { tables: false, kitchenScreen: false, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thank you for your visit!'),
    categories: [
      { name: 'Coffee', emoji: '☕' },
      { name: 'Tea & Infusions', emoji: '🫖' },
      { name: 'Juices', emoji: '🧃' },
      { name: 'Pastries', emoji: '🥐' },
      { name: 'Snacks', emoji: '🥪' },
      { name: 'Cold Drinks', emoji: '🥤' },
    ],
  },
  restaurant: {
    posMode: 'cashier',
    features: { tables: true, kitchenScreen: true, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thank you for dining with us!'),
    categories: [
      { name: 'Starters', emoji: '🥗' },
      { name: 'Main courses', emoji: '🍽️' },
      { name: 'Sides', emoji: '🍟' },
      { name: 'Desserts', emoji: '🍰' },
      { name: 'Drinks', emoji: '🥤' },
    ],
  },
  bakery: {
    posMode: 'cashier',
    features: { tables: false, kitchenScreen: false, barcode: true, weightItems: true },
    receiptFooter: receiptFooter('Freshly baked for you!'),
    categories: [
      { name: 'Bread', emoji: '🍞' },
      { name: 'Pastries', emoji: '🥐' },
      { name: 'Cakes', emoji: '🎂' },
      { name: 'Cookies', emoji: '🍪' },
      { name: 'Drinks', emoji: '🥤' },
    ],
  },
  snack: {
    posMode: 'quick',
    features: { tables: false, kitchenScreen: false, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thanks — see you soon!'),
    categories: [
      { name: 'Sandwiches', emoji: '🥪' },
      { name: 'Snacks', emoji: '🍟' },
      { name: 'Salads', emoji: '🥗' },
      { name: 'Desserts', emoji: '🍩' },
      { name: 'Drinks', emoji: '🥤' },
    ],
  },
  retail: {
    posMode: 'cashier',
    features: { tables: false, kitchenScreen: false, barcode: true, weightItems: true },
    receiptFooter: receiptFooter('Thank you for shopping with us!'),
    categories: [
      { name: 'Groceries', emoji: '🛒' },
      { name: 'Drinks', emoji: '🥤' },
      { name: 'Household', emoji: '🧹' },
      { name: 'Personal care', emoji: '🧴' },
    ],
  },
  salon: {
    posMode: 'cashier',
    features: { tables: false, kitchenScreen: false, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thank you — we look forward to seeing you again!'),
    categories: [
      { name: 'Hair services', emoji: '💇' },
      { name: 'Nail services', emoji: '💅' },
      { name: 'Skin care', emoji: '✨' },
      { name: 'Retail products', emoji: '🧴' },
    ],
  },
}

export const businessTemplate = (type: BusinessType): BusinessTemplate => {
  const template = templates[type]
  return {
    ...template,
    features: { ...template.features },
    categories: template.categories.map((category) => ({ ...category })),
  }
}
