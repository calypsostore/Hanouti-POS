export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 6
export const PIN_PATTERN = new RegExp(`^[A-Za-z0-9]{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`)
export const PIN_RANGE_HINT = `${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} letters or numbers`

export const isValidPin = (value: string): boolean => PIN_PATTERN.test(value)
export const normalizePin = (value: string): string => value.trim().toUpperCase()
