export type DashboardTone = 'green' | 'blue' | 'amber' | 'rose' | 'purple' | 'teal'

export const DASHBOARD_PALETTE: Record<
  DashboardTone,
  { gradient: string; icon: string; iconColor: string; text: string }
> = {
  green: {
    gradient: 'glass-tint-green',
    icon: 'bg-[var(--semantic-green-soft)]',
    iconColor: 'text-[var(--semantic-green-text)]',
    text: 'text-ink',
  },
  blue: {
    gradient: 'glass-tint-blue',
    icon: 'bg-[var(--semantic-blue-soft)]',
    iconColor: 'text-[var(--semantic-blue-text)]',
    text: 'text-ink',
  },
  amber: {
    gradient: 'glass-tint-amber',
    icon: 'bg-[var(--semantic-amber-soft)]',
    iconColor: 'text-[var(--semantic-amber-text)]',
    text: 'text-ink',
  },
  rose: {
    gradient: 'glass-tint-rose',
    icon: 'bg-[var(--semantic-rose-soft)]',
    iconColor: 'text-[var(--semantic-rose-text)]',
    text: 'text-ink',
  },
  purple: {
    gradient: 'glass-tint-violet',
    icon: 'bg-[var(--semantic-violet-soft)]',
    iconColor: 'text-[var(--semantic-violet-text)]',
    text: 'text-ink',
  },
  teal: {
    gradient: 'glass-tint-teal',
    icon: 'bg-[var(--semantic-teal-soft)]',
    iconColor: 'text-[var(--semantic-teal-text)]',
    text: 'text-ink',
  },
}

export const SOFT_TONE: Record<DashboardTone, string> = {
  green: 'bg-[var(--semantic-green-soft)] text-[var(--semantic-green-text)]',
  blue: 'bg-[var(--semantic-blue-soft)] text-[var(--semantic-blue-text)]',
  amber: 'bg-[var(--semantic-amber-soft)] text-[var(--semantic-amber-text)]',
  rose: 'bg-[var(--semantic-rose-soft)] text-[var(--semantic-rose-text)]',
  purple: 'bg-[var(--semantic-violet-soft)] text-[var(--semantic-violet-text)]',
  teal: 'bg-[var(--semantic-teal-soft)] text-[var(--semantic-teal-text)]',
}
