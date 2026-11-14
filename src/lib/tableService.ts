import type { GuestRequirement } from '../types'

export function guestCountError(
  guests: number | undefined,
  requirement: GuestRequirement,
): string | undefined {
  if (requirement === 'off') return undefined
  if (guests === undefined) {
    return requirement === 'required' ? 'Enter the number of guests.' : undefined
  }
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 50) {
    return 'Guests must be a whole number from 1 to 50.'
  }
  return undefined
}
