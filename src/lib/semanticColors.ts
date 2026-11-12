import type { IconColor } from '../types'

export type SemanticColor = {
  solid: string
  softBackground: string
  border: string
  text: string
  gradient: string
}

type ThemeColors = Record<'light' | 'dark', SemanticColor>
type SemanticEntry = {
  light: SemanticColor
  dark: SemanticColor
}

const palette = (name: string): SemanticEntry => ({
  light: {
    solid: `var(--semantic-${name}-solid)`,
    softBackground: `var(--semantic-${name}-soft)`,
    border: `var(--semantic-${name}-border)`,
    text: `var(--semantic-${name}-text)`,
    gradient: `var(--semantic-${name}-gradient)`,
  },
  dark: {
    solid: `var(--semantic-${name}-solid-dark)`,
    softBackground: `var(--semantic-${name}-soft-dark)`,
    border: `var(--semantic-${name}-border-dark)`,
    text: `var(--semantic-${name}-text-dark)`,
    gradient: `var(--semantic-${name}-gradient-dark)`,
  },
})

export const SEMANTIC_COLORS = {
  payment: {
    cash: palette('green'),
    card: palette('blue'),
    credit: palette('amber'),
    tracked: palette('violet'),
    other: palette('slate'),
  },
  orderStatus: {
    completed: palette('green'),
    open: palette('blue'),
    tracked: palette('violet'),
    void: palette('red'),
    returned: palette('rose'),
  },
  stock: {
    ok: palette('green'),
    low: palette('amber'),
    out: palette('red'),
  },
  moneyFlow: {
    revenue: palette('green'),
    expenses: palette('rose'),
    profit: palette('teal'),
    tips: palette('pink'),
    discounts: palette('orange'),
  },
  trends: {
    up: palette('green'),
    down: palette('red'),
    flat: palette('slate'),
  },
  icons: {
    green: palette('green'),
    blue: palette('blue'),
    amber: palette('amber'),
    rose: palette('rose'),
    violet: palette('violet'),
    teal: palette('teal'),
    slate: palette('slate'),
    orange: palette('orange'),
  } satisfies Record<IconColor, ThemeColors>,
} as const

export const semanticColorFor = (
  category: keyof typeof SEMANTIC_COLORS,
  key: string,
  theme: 'light' | 'dark' = 'light',
): SemanticColor => {
  const entries = SEMANTIC_COLORS[category]
  const entry = entries[key as keyof typeof entries]
  if (!entry) return SEMANTIC_COLORS.trends.flat[theme]
  return entry[theme]
}

export const paymentColor = (method: string): string => {
  const colors = SEMANTIC_COLORS.payment
  if (method === 'cash') return colors.cash.light.solid
  if (method === 'card') return colors.card.light.solid
  if (method === 'credit') return colors.credit.light.solid
  return colors.other.light.solid
}
