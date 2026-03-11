import { tzAbbr } from '@/lib/tz-utils'

const TREND_ARROWS: Record<string, string> = {
  DoubleUp: '↑↑',
  SingleUp: '↑',
  FortyFiveUp: '↗',
  Flat: '→',
  FortyFiveDown: '↘',
  SingleDown: '↓',
  DoubleDown: '↓↓',
}

export function formatTrend(trend: string | null | undefined): string {
  if (!trend) return '—'
  return TREND_ARROWS[trend] ?? trend
}

/**
 * Format a UTC ISO timestamp for display in the given IANA timezone.
 * Always produces "DD Mon HH:mm ABBR" (e.g. "11 Mar 13:41 CET").
 *
 * Handles timestamps with or without a trailing 'Z': strings without explicit
 * timezone info (e.g. "2026-03-11T12:41:00") are treated as UTC, matching the
 * backend's storage convention.
 */
export function formatTs(iso: string, tz: string): string {
  // Treat timezone-naïve strings as UTC so "12:41" → 13:41 in CET.
  // Also handles +00:00 / +HH:MM offsets already present in the string.
  const utcIso = /Z|[+-]\d{2}/.test(iso.slice(10)) ? iso : iso + 'Z'
  const d = new Date(utcIso)

  const dateParts = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    timeZone: tz,
  }).formatToParts(d)
  const day = dateParts.find((p) => p.type === 'day')?.value ?? ''
  const month = dateParts.find((p) => p.type === 'month')?.value ?? ''

  const time = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    timeZone: tz,
  }).format(d)

  const abbr = tzAbbr(tz, d)

  return `${day} ${month} ${time} ${abbr}`
}
