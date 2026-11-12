export type DashboardTone = 'green' | 'blue' | 'amber' | 'rose' | 'purple' | 'teal'

export const DASHBOARD_PALETTE: Record<
  DashboardTone,
  { gradient: string; icon: string; iconColor: string; text: string }
> = {
  green: {
    gradient: 'from-emerald-500 to-emerald-700',
    icon: 'bg-white/15',
    iconColor: 'text-white',
    text: 'text-white',
  },
  blue: {
    gradient: 'from-blue-500 to-blue-700',
    icon: 'bg-white/15',
    iconColor: 'text-white',
    text: 'text-white',
  },
  amber: {
    gradient: 'from-brand-amber to-brand-amber-hover',
    icon: 'bg-brand-navy/10',
    iconColor: 'text-brand-navy',
    text: 'text-brand-navy',
  },
  rose: {
    gradient: 'from-rose-500 to-rose-700',
    icon: 'bg-white/15',
    iconColor: 'text-white',
    text: 'text-white',
  },
  purple: {
    gradient: 'from-violet-500 to-violet-700',
    icon: 'bg-white/15',
    iconColor: 'text-white',
    text: 'text-white',
  },
  teal: {
    gradient: 'from-teal-500 to-teal-700',
    icon: 'bg-white/15',
    iconColor: 'text-white',
    text: 'text-white',
  },
}

export const SOFT_TONE: Record<DashboardTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  amber: 'bg-brand-amber-soft text-brand-navy dark:bg-amber-950/60 dark:text-amber-200',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  purple: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
}
