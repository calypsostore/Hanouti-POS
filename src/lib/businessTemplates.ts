import type { BusinessType, IconColor, IconName, PosMode, StoreFeatures } from '../types'
import { BRAND_NAME } from './brand.ts'

const receiptFooter = (message: string) => `${message} · ${BRAND_NAME}`

export interface BusinessTemplate {
  posMode: PosMode
  features: StoreFeatures
  receiptFooter: string
  categories: Array<{ name: string; icon: IconName; iconColor: IconColor; station?: 'Kitchen' | 'Bar' }>
}

const templates: Record<BusinessType, BusinessTemplate> = {
  cafe: {
    posMode: 'quick',
    features: { tables: false, delivery: false, kitchenScreen: false, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thank you for your visit!'),
    categories: [
      { name: 'Coffee', icon: 'Coffee', iconColor: 'amber', station: 'Bar' },
      { name: 'Tea & Infusions', icon: 'Coffee', iconColor: 'green', station: 'Bar' },
      { name: 'Juices', icon: 'CupSoda', iconColor: 'orange', station: 'Bar' },
      { name: 'Pastries', icon: 'Croissant', iconColor: 'amber', station: 'Kitchen' },
      { name: 'Snacks', icon: 'Sandwich', iconColor: 'teal', station: 'Kitchen' },
      { name: 'Cold Drinks', icon: 'CupSoda', iconColor: 'blue', station: 'Bar' },
    ],
  },
  restaurant: {
    posMode: 'quick',
    features: { tables: true, delivery: false, kitchenScreen: true, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thank you for dining with us!'),
    categories: [
      { name: 'Starters', icon: 'Salad', iconColor: 'green', station: 'Kitchen' },
      { name: 'Main courses', icon: 'UtensilsCrossed', iconColor: 'rose', station: 'Kitchen' },
      { name: 'Sides', icon: 'Utensils', iconColor: 'amber', station: 'Kitchen' },
      { name: 'Desserts', icon: 'Cake', iconColor: 'violet', station: 'Kitchen' },
      { name: 'Drinks', icon: 'CupSoda', iconColor: 'blue', station: 'Bar' },
    ],
  },
  bakery: {
    posMode: 'quick',
    features: { tables: false, delivery: false, kitchenScreen: false, barcode: true, weightItems: true },
    receiptFooter: receiptFooter('Freshly baked for you!'),
    categories: [
      { name: 'Bread', icon: 'Croissant', iconColor: 'amber', station: 'Kitchen' },
      { name: 'Pastries', icon: 'Croissant', iconColor: 'orange', station: 'Kitchen' },
      { name: 'Cakes', icon: 'Cake', iconColor: 'rose', station: 'Kitchen' },
      { name: 'Cookies', icon: 'Cookie', iconColor: 'amber', station: 'Kitchen' },
      { name: 'Drinks', icon: 'CupSoda', iconColor: 'blue', station: 'Bar' },
    ],
  },
  snack: {
    posMode: 'quick',
    features: { tables: false, delivery: false, kitchenScreen: false, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thanks — see you soon!'),
    categories: [
      { name: 'Sandwiches', icon: 'Sandwich', iconColor: 'amber', station: 'Kitchen' },
      { name: 'Snacks', icon: 'Pizza', iconColor: 'orange', station: 'Kitchen' },
      { name: 'Salads', icon: 'Salad', iconColor: 'green', station: 'Kitchen' },
      { name: 'Desserts', icon: 'Cake', iconColor: 'rose', station: 'Kitchen' },
      { name: 'Drinks', icon: 'CupSoda', iconColor: 'blue', station: 'Bar' },
    ],
  },
  retail: {
    posMode: 'quick',
    features: { tables: false, delivery: false, kitchenScreen: false, barcode: true, weightItems: true },
    receiptFooter: receiptFooter('Thank you for shopping with us!'),
    categories: [
      { name: 'Groceries', icon: 'ShoppingBasket', iconColor: 'green' },
      { name: 'Drinks', icon: 'CupSoda', iconColor: 'blue' },
      { name: 'Household', icon: 'Package', iconColor: 'slate' },
      { name: 'Personal care', icon: 'Flower2', iconColor: 'violet' },
    ],
  },
  salon: {
    posMode: 'quick',
    features: { tables: false, delivery: false, kitchenScreen: false, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thank you — we look forward to seeing you again!'),
    categories: [
      { name: 'Hair services', icon: 'Scissors', iconColor: 'violet' },
      { name: 'Nail services', icon: 'Star', iconColor: 'rose' },
      { name: 'Skin care', icon: 'Sparkles', iconColor: 'amber' },
      { name: 'Retail products', icon: 'Gift', iconColor: 'teal' },
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
