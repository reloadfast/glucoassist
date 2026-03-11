/**
 * Timezone utilities using Intl.DateTimeFormat — no external dependencies.
 *
 * Key design: datetime-local inputs (e.g. "2026-03-11T10:30") carry NO timezone
 * info. All dialogs must convert to/from IANA tz when reading/submitting.
 */

/**
 * Return a human-friendly timezone abbreviation (e.g. "CET", "EST") for the
 * given IANA timezone at the given instant.
 *
 * On platforms where Intl already returns a proper abbreviation the native
 * value is used directly.  On Linux/Chrome (and Node.js) Intl often returns
 * "GMT+1" style offsets for well-known zones; in that case the function falls
 * back to a curated lookup table so the UI shows "CET" instead of "GMT+1".
 */
export function tzAbbr(tz: string, d: Date): string {
  let shortName: string
  try {
    shortName =
      new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
        .formatToParts(d)
        .find((p) => p.type === 'timeZoneName')?.value ?? tz
  } catch {
    return tz
  }

  // If Intl already gave a "real" abbreviation (not GMT±N), use it.
  const gmtMatch = shortName.match(/^GMT([+-])(\d+)(?::(\d+))?$/)
  if (!gmtMatch) return shortName

  // Parse offset minutes from "GMT+1", "GMT+2:30", etc.
  const sign = gmtMatch[1] === '+' ? 1 : -1
  const offsetMin = sign * (parseInt(gmtMatch[2]) * 60 + parseInt(gmtMatch[3] ?? '0'))

  return ABBR_MAP[tz]?.[String(offsetMin)] ?? shortName
}

/**
 * Curated map: IANA timezone → UTC-offset-minutes (string key) → traditional abbreviation.
 * Only covers zones that commonly return "GMT±N" from Intl on Linux/Node.js.
 */
const ABBR_MAP: Readonly<Record<string, Record<string, string>>> = {
  // Central European Time (UTC+1 / UTC+2)
  'Europe/Amsterdam': { 60: 'CET', 120: 'CEST' },
  'Europe/Andorra': { 60: 'CET', 120: 'CEST' },
  'Europe/Belgrade': { 60: 'CET', 120: 'CEST' },
  'Europe/Berlin': { 60: 'CET', 120: 'CEST' },
  'Europe/Bratislava': { 60: 'CET', 120: 'CEST' },
  'Europe/Brussels': { 60: 'CET', 120: 'CEST' },
  'Europe/Budapest': { 60: 'CET', 120: 'CEST' },
  'Europe/Copenhagen': { 60: 'CET', 120: 'CEST' },
  'Europe/Gibraltar': { 60: 'CET', 120: 'CEST' },
  'Europe/Ljubljana': { 60: 'CET', 120: 'CEST' },
  'Europe/Luxembourg': { 60: 'CET', 120: 'CEST' },
  'Europe/Madrid': { 60: 'CET', 120: 'CEST' },
  'Europe/Malta': { 60: 'CET', 120: 'CEST' },
  'Europe/Monaco': { 60: 'CET', 120: 'CEST' },
  'Europe/Oslo': { 60: 'CET', 120: 'CEST' },
  'Europe/Paris': { 60: 'CET', 120: 'CEST' },
  'Europe/Podgorica': { 60: 'CET', 120: 'CEST' },
  'Europe/Prague': { 60: 'CET', 120: 'CEST' },
  'Europe/Rome': { 60: 'CET', 120: 'CEST' },
  'Europe/San_Marino': { 60: 'CET', 120: 'CEST' },
  'Europe/Sarajevo': { 60: 'CET', 120: 'CEST' },
  'Europe/Skopje': { 60: 'CET', 120: 'CEST' },
  'Europe/Stockholm': { 60: 'CET', 120: 'CEST' },
  'Europe/Tirane': { 60: 'CET', 120: 'CEST' },
  'Europe/Vaduz': { 60: 'CET', 120: 'CEST' },
  'Europe/Vatican': { 60: 'CET', 120: 'CEST' },
  'Europe/Vienna': { 60: 'CET', 120: 'CEST' },
  'Europe/Warsaw': { 60: 'CET', 120: 'CEST' },
  'Europe/Zagreb': { 60: 'CET', 120: 'CEST' },
  'Europe/Zurich': { 60: 'CET', 120: 'CEST' },
  // Eastern European Time (UTC+2 / UTC+3)
  'Europe/Athens': { 120: 'EET', 180: 'EEST' },
  'Europe/Bucharest': { 120: 'EET', 180: 'EEST' },
  'Europe/Helsinki': { 120: 'EET', 180: 'EEST' },
  'Europe/Kiev': { 120: 'EET', 180: 'EEST' },
  'Europe/Kyiv': { 120: 'EET', 180: 'EEST' },
  'Europe/Nicosia': { 120: 'EET', 180: 'EEST' },
  'Europe/Riga': { 120: 'EET', 180: 'EEST' },
  'Europe/Sofia': { 120: 'EET', 180: 'EEST' },
  'Europe/Tallinn': { 120: 'EET', 180: 'EEST' },
  'Europe/Uzhgorod': { 120: 'EET', 180: 'EEST' },
  'Europe/Vilnius': { 120: 'EET', 180: 'EEST' },
  'Europe/Zaporozhye': { 120: 'EET', 180: 'EEST' },
  // UK / Ireland
  'Europe/Dublin': { '0': 'GMT', '60': 'IST' },
  'Europe/London': { '0': 'GMT', '60': 'BST' },
  'Europe/Guernsey': { '0': 'GMT', '60': 'BST' },
  'Europe/Isle_of_Man': { '0': 'GMT', '60': 'BST' },
  'Europe/Jersey': { '0': 'GMT', '60': 'BST' },
  // Portugal / Azores
  'Europe/Lisbon': { '0': 'WET', '60': 'WEST' },
  'Atlantic/Azores': { '-60': 'AZOT', '0': 'AZOST' },
  // North America Eastern
  'America/Detroit': { '-300': 'EST', '-240': 'EDT' },
  'America/Indiana/Indianapolis': { '-300': 'EST', '-240': 'EDT' },
  'America/New_York': { '-300': 'EST', '-240': 'EDT' },
  'America/Toronto': { '-300': 'EST', '-240': 'EDT' },
  // North America Central
  'America/Chicago': { '-360': 'CST', '-300': 'CDT' },
  'America/Mexico_City': { '-360': 'CST', '-300': 'CDT' },
  'America/Winnipeg': { '-360': 'CST', '-300': 'CDT' },
  // North America Mountain
  'America/Boise': { '-420': 'MST', '-360': 'MDT' },
  'America/Denver': { '-420': 'MST', '-360': 'MDT' },
  'America/Edmonton': { '-420': 'MST', '-360': 'MDT' },
  'America/Phoenix': { '-420': 'MST' },
  // North America Pacific
  'America/Los_Angeles': { '-480': 'PST', '-420': 'PDT' },
  'America/Vancouver': { '-480': 'PST', '-420': 'PDT' },
  // Japan / Korea / China
  'Asia/Tokyo': { '540': 'JST' },
  'Asia/Seoul': { '540': 'KST' },
  'Asia/Shanghai': { '480': 'CST' },
  'Asia/Hong_Kong': { '480': 'HKT' },
  'Asia/Singapore': { '480': 'SGT' },
  'Asia/Taipei': { '480': 'CST' },
  // India / Sri Lanka
  'Asia/Kolkata': { '330': 'IST' },
  'Asia/Colombo': { '330': 'IST' },
  // Australia
  'Australia/Sydney': { '600': 'AEST', '660': 'AEDT' },
  'Australia/Melbourne': { '600': 'AEST', '660': 'AEDT' },
  'Australia/Brisbane': { '600': 'AEST' },
  'Australia/Perth': { '480': 'AWST' },
  'Australia/Adelaide': { '570': 'ACST', '630': 'ACDT' },
}

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
