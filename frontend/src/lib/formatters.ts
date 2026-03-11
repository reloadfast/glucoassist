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
 * Uses formatToParts to guarantee day-first order regardless of locale.
 */
export function formatTs(iso: string, tz: string): string {
  const d = new Date(iso)

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

  const abbr =
    new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value ?? tz

  return `${day} ${month} ${time} ${abbr}`
}
