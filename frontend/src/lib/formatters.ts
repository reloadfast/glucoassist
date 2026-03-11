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
 * Appends the timezone abbreviation (e.g. "CET", "UTC", "EDT").
 */
export function formatTs(iso: string, tz: string): string {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
    timeZoneName: 'short',
  })
  // Intl formats vary by locale; split on the timezone name part
  const parts = fmt.formatToParts(d)
  const datePart = parts
    .filter((p) => (p.type !== 'timeZoneName' && p.type !== 'literal') || p.value !== ', ')
    .map((p) => p.value)
    .join('')
    .replace(/,\s*$/, '')
    .trim()
  const tzAbbr = parts.find((p) => p.type === 'timeZoneName')?.value ?? tz
  return `${datePart} ${tzAbbr}`
}
