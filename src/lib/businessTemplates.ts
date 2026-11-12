import type { BusinessType, IconColor, IconName, PosMode, StoreFeatures } from '../types'
import { BRAND_NAME } from './brand'

const receiptFooter = (message: string) => `${message} · ${BRAND_NAME}`

export interface BusinessTemplate {
  posMode: PosMode
  features: StoreFeatures
  receiptFooter: string
  categories: Array<{ name: string; icon: IconName; iconColor: IconColor }>
}

const templates: Record<BusinessType, BusinessTemplate> = {
  cafe: {
    posMode: 'cashier',
    features: { tables: false, delivery: false, kitchenScreen: false, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thank you for your visit!'),
    categories: [
      { name: 'Coffee', icon: 'Coffee', iconColor: 'amber' },
      { name: 'Tea & Infusions', icon: 'Coffee', iconColor: 'green' },
      { name: 'Juices', icon: 'CupSoda', iconColor: 'orange' },
      { name: 'Pastries', icon: 'Croissant', iconColor: 'amber' },
      { name: 'Snacks', icon: 'Sandwich', iconColor: 'teal' },
      { name: 'Cold Drinks', icon: 'CupSoda', iconColor: 'blue' },
    ],
  },
  restaurant: {
    posMode: 'cashier',
    features: { tables: true, delivery: false, kitchenScreen: true, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thank you for dining with us!'),
    categories: [
      { name: 'Starters', icon: 'Salad', iconColor: 'green' },
      { name: 'Main courses', icon: 'UtensilsCrossed', iconColor: 'rose' },
      { name: 'Sides', icon: 'Utensils', iconColor: 'amber' },
      { name: 'Desserts', icon: 'Cake', iconColor: 'violet' },
      { name: 'Drinks', icon: 'CupSoda', iconColor: 'blue' },
    ],
  },
  bakery: {
    posMode: 'cashier',
    features: { tables: false, delivery: false, kitchenScreen: false, barcode: true, weightItems: true },
    receiptFooter: receiptFooter('Freshly baked for you!'),
    categories: [
      { name: 'Bread', icon: 'Croissant', iconColor: 'amber' },
      { name: 'Pastries', icon: 'Croissant', iconColor: 'orange' },
      { name: 'Cakes', icon: 'Cake', iconColor: 'rose' },
      { name: 'Cookies', icon: 'Cookie', iconColor: 'amber' },
      { name: 'Drinks', icon: 'CupSoda', iconColor: 'blue' },
    ],
  },
  snack: {
    posMode: 'quick',
    features: { tables: false, delivery: false, kitchenScreen: false, barcode: false, weightItems: false },
    receiptFooter: receiptFooter('Thanks — see you soon!'),
    categories: [
      { name: 'Sandwiches', icon: 'Sandwich', iconColor: 'amber' },
      { name: 'Snacks', icon: 'Pizza', iconColor: 'orange' },
      { name: 'Salads', icon: 'Salad', iconColor: 'green' },
      { name: 'Desserts', icon: 'Cake', iconColor: 'rose' },
      { name: 'Drinks', icon: 'CupSoda', iconColor: 'blue' },
    ],
  },
  retail: {
    posMode: 'cashier',
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
    posMode: 'cashier',
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
