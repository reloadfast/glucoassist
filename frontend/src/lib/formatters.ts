import type { Tz } from '@/components/TimezoneProvider'

const LOCAL_FMT = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const UTC_FMT = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

export function formatTs(iso: string, tz: Tz): string {
  const d = new Date(iso)
  if (tz === 'utc') {
    return UTC_FMT.format(d) + ' UTC'
  }
  return LOCAL_FMT.format(d)
}
