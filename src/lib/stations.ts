import type { Station } from '../types'

export const defaultStationNameForCategory = (name: string): 'Kitchen' | 'Bar' | undefined => {
  const normalized = name.toLowerCase()
  return /coffee|tea|juice|drink|beverage|soda|bar/.test(normalized)
    ? 'Bar'
    : /food|pastr|bread|snack|salad|main|dessert|side|starter|sandwich|cake|cookie/.test(normalized)
      ? 'Kitchen'
      : undefined
}

export const resolveProductStationId = (
  productName: string,
  explicitStationId: string | null | undefined,
  categoryStationId: string | undefined,
): string | null | undefined => {
  if (explicitStationId === null) return null
  if (explicitStationId) return explicitStationId
  if (/water/i.test(productName)) return null
  return categoryStationId
}

export function defaultStationsForStore(storeId: string): Station[] {
  const defaults: Array<Pick<Station, 'name' | 'icon' | 'color' | 'screen'>> = [
    { name: 'Kitchen', icon: 'Utensils', color: 'rose', screen: true },
    { name: 'Bar', icon: 'CupSoda', color: 'blue', screen: true },
  ]
  return defaults.map((station, sort) => ({
    ...station,
    id: `sta_${storeId}_${station.name.toLowerCase()}`,
    storeId,
    active: true,
    sort,
  }))
}
