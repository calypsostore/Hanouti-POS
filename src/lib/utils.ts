import clsx, { type ClassValue } from 'clsx'
import type { SettlementCycle } from '../types'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

export const money = (n: number) => {
  const value = Number.isFinite(n) ? n : 0
  const [whole, decimals] = Math.abs(value).toFixed(3).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${value < 0 ? '-' : ''}${grouped},${decimals} DT`
}

export const compactMoney = (n: number) => {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k DT`
  return `${Math.round(n)} DT`
}

export const uid = (prefix: string) =>
  `${prefix}_${typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`}`

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

export const isoDaysAgo = (days: number, hour = 12, minute = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const startOfDay = (d = new Date()) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export const dateKey = (d: Date | string) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(
    x.getDate(),
  ).padStart(2, '0')}`
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export const cycleLabel = (cycle: SettlementCycle = 'monthly') =>
  cycle === 'weekly' ? 'Weekly' : cycle === 'on-demand' ? 'On demand' : 'Monthly'

export const nextDueLabel = (cycle: SettlementCycle = 'monthly', from = new Date()) => {
  if (cycle === 'on-demand') return 'Pay anytime'
  if (cycle === 'weekly') {
    const d = new Date(from)
    const add = (5 - d.getDay() + 7) % 7
    d.setDate(d.getDate() + add)
    if (add === 0) return 'Due today'
    return `Due ${d.toLocaleDateString('en-GB', { weekday: 'short' })}`
  }
  const end = new Date(from.getFullYear(), from.getMonth() + 1, 0)
  if (dateKey(end) === dateKey(from)) return 'Due today'
  return `Due ${end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
}

export const relative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

export const sum = <T,>(arr: T[], pick: (x: T) => number) =>
  arr.reduce((acc, x) => acc + pick(x), 0)

export const monthLabel = (d: Date) =>
  d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })

export const csvDownload = (filename: string, rows: (string | number)[][]) => {
  const body = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '')
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\n')
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
