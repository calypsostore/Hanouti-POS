export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 12
export const PIN_PATTERN = new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`)
export const PIN_RANGE_HINT = `${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`

export const isValidPin = (value: string): boolean => PIN_PATTERN.test(value)
