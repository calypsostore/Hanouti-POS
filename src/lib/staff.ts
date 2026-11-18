import type { User } from '../types'

const USERNAME_PATTERN = /^[a-z0-9._-]{3,64}$/

export const normalizeUsername = (value: string) => value.trim().toLowerCase()

export const isValidUsername = (value: string) => USERNAME_PATTERN.test(value)

export const isUsernameForStore = (value: string, storeSlug: string) =>
  normalizeUsername(value).endsWith(`.${normalizeUsername(storeSlug)}`)

export const shouldTrackAttendance = (user: Pick<User, 'role' | 'attendanceEnabled'>) =>
  user.role === 'staff' && user.attendanceEnabled !== false

const usernamePart = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'staff'

export const suggestStaffUsername = (
  name: string,
  storeSlug: string,
  users: User[],
  excludeUserId?: string,
) => {
  const firstName = usernamePart(name.trim().split(/\s+/)[0] ?? '').slice(0, 23)
  const slug = usernamePart(storeSlug).slice(0, 40)
  const base = `${firstName}.${slug}`
  const taken = new Set(
    users
      .filter((user) => user.id !== excludeUserId)
      .map((user) => normalizeUsername(user.username ?? '')),
  )
  if (!taken.has(base)) return base

  for (let number = 2; ; number += 1) {
    const suffix = String(number)
    const candidate = `${firstName.slice(0, 23 - suffix.length)}${suffix}.${slug}`
    if (!taken.has(candidate)) return candidate
  }
}
