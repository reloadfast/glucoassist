/**
 * Timezone utilities using Intl.DateTimeFormat — no external dependencies.
 *
 * Key design: datetime-local inputs (e.g. "2026-03-11T10:30") carry NO timezone
 * info. All dialogs must convert to/from IANA tz when reading/submitting.
 */

/** Return "YYYY-MM-DDTHH:mm" for right now in the given IANA timezone. */
export function localNow(tz: string): string {
  return isoToLocalInput(new Date(), tz)
}

/**
 * Format a Date (or UTC ISO string) as a datetime-local input value
 * ("YYYY-MM-DDTHH:mm") in the given IANA timezone.
 */
export function isoToLocalInput(date: Date | string, tz: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const hour = get('hour') === '24' ? '00' : get('hour') // midnight guard
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/**
 * Convert a datetime-local input value ("YYYY-MM-DDTHH:mm[ss]") entered by the
 * user in `tz` (IANA name) to a UTC ISO-8601 string.
 *
 * Algorithm (zero-dep, DST-aware):
 *  1. Treat `localStr` as UTC (append "Z") → `naiveUtc`
 *  2. Format `naiveUtc` in the target timezone → `shiftedLocal`
 *  3. diff = shiftedLocal − naiveUtc  (= UTC offset of the tz at that instant)
 *  4. actual UTC = naiveUtc − diff
 */
export function toUtcISO(localStr: string, tz: string): string {
  // Normalise to seconds precision for the intermediate calculation
  const normalized = localStr.length === 16 ? localStr + ':00' : localStr
  const naiveUtc = new Date(normalized + 'Z')

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(naiveUtc)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const hour = get('hour') === '24' ? '00' : get('hour')
  const shiftedLocal = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}Z`,
  )

  const offsetMs = shiftedLocal.getTime() - naiveUtc.getTime()
  return new Date(naiveUtc.getTime() - offsetMs).toISOString()
}

/**
 * Detect the browser's local IANA timezone name.
 * Falls back to "UTC" if the Intl API is unavailable.
 */
export function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Get all IANA timezone names supported by this browser/runtime,
 * sorted alphabetically with "UTC" always first.
 * Falls back to a curated list on older browsers.
 */
export function allIanaTz(): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const names: string[] = (Intl as any).supportedValuesOf('timeZone')
    return ['UTC', ...names.filter((n) => n !== 'UTC')]
  } catch {
    return FALLBACK_TZ_LIST
  }
}

const FALLBACK_TZ_LIST = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Bangkok',
  'Asia/Colombo',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Tehran',
  'Asia/Tokyo',
  'Atlantic/Azores',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Brussels',
  'Europe/Budapest',
  'Europe/Copenhagen',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Honolulu',
]
