export function toSafeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'bigint') {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

export function toSafeBoolean(value: unknown, fallback: boolean = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' || typeof value === 'bigint') return Number(value) !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  }
  return fallback
}

export function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') {
        const n = Number(v)
        return Number.isSafeInteger(n) ? n : v.toString()
      }
      return v
    })
  )
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error ?? '')
}
