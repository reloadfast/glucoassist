import { describe, it, expect } from 'vitest'
import { toUtcISO, isoToLocalInput, localNow } from '@/lib/tz-utils'

describe('toUtcISO', () => {
  it('converts CET (UTC+1) winter time correctly', () => {
    // 10:30 in Europe/Madrid (UTC+1 in winter) = 09:30 UTC
    const result = toUtcISO('2026-03-11T10:30', 'Europe/Madrid')
    expect(result).toBe('2026-03-11T09:30:00.000Z')
  })

  it('converts CEST (UTC+2) summer time correctly', () => {
    // 10:30 in Europe/Madrid (UTC+2 in summer) = 08:30 UTC
    const result = toUtcISO('2026-07-15T10:30', 'Europe/Madrid')
    expect(result).toBe('2026-07-15T08:30:00.000Z')
  })

  it('UTC timezone is a no-op', () => {
    const result = toUtcISO('2026-03-11T10:30', 'UTC')
    expect(result).toBe('2026-03-11T10:30:00.000Z')
  })

  it('converts US Eastern (UTC-5) winter time correctly', () => {
    // 09:00 in America/New_York (UTC-5) = 14:00 UTC
    const result = toUtcISO('2026-01-15T09:00', 'America/New_York')
    expect(result).toBe('2026-01-15T14:00:00.000Z')
  })

  it('converts US Eastern (UTC-4) summer time correctly', () => {
    // 09:00 in America/New_York (EDT = UTC-4) = 13:00 UTC
    const result = toUtcISO('2026-07-15T09:00', 'America/New_York')
    expect(result).toBe('2026-07-15T13:00:00.000Z')
  })

  it('handles midnight correctly', () => {
    const result = toUtcISO('2026-03-11T00:00', 'Asia/Tokyo') // UTC+9
    expect(result).toBe('2026-03-10T15:00:00.000Z')
  })

  it('accepts seconds precision input', () => {
    const result = toUtcISO('2026-03-11T10:30:45', 'UTC')
    expect(result).toBe('2026-03-11T10:30:45.000Z')
  })
})

describe('isoToLocalInput', () => {
  it('formats UTC time as local datetime-local in CET', () => {
    // 2026-03-11T09:30:00Z → 10:30 in Europe/Madrid (UTC+1 winter)
    const result = isoToLocalInput('2026-03-11T09:30:00Z', 'Europe/Madrid')
    expect(result).toBe('2026-03-11T10:30')
  })

  it('formats UTC time as local datetime-local in UTC', () => {
    const result = isoToLocalInput('2026-03-11T09:30:00Z', 'UTC')
    expect(result).toBe('2026-03-11T09:30')
  })

  it('accepts a Date object', () => {
    const d = new Date('2026-03-11T12:00:00Z')
    const result = isoToLocalInput(d, 'UTC')
    expect(result).toBe('2026-03-11T12:00')
  })
})

describe('localNow', () => {
  it('returns a datetime-local formatted string', () => {
    const result = localNow('UTC')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('round-trips: localNow → toUtcISO is close to Date.now()', () => {
    const tz = 'Europe/Madrid'
    const before = Date.now()
    const local = localNow(tz)
    const utcIso = toUtcISO(local, tz)
    const after = Date.now()
    const recovered = new Date(utcIso).getTime()
    // Within 1 minute (localNow truncates to minutes)
    expect(recovered).toBeGreaterThanOrEqual(before - 60_000)
    expect(recovered).toBeLessThanOrEqual(after + 60_000)
  })
})
