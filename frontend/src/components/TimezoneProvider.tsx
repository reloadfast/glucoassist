import { createContext, useContext, useState } from 'react'
import { browserTz } from '@/lib/tz-utils'

/**
 * IANA timezone name (e.g. "Europe/Madrid", "UTC", "America/New_York").
 * Legacy values "local" and "utc" are migrated on first read.
 */
export type Tz = string

interface TzContextValue {
  tz: Tz
  setTz: (tz: Tz) => void
}

const TzContext = createContext<TzContextValue>({
  tz: 'UTC',
  setTz: () => {},
})

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider is intentional
export function useTimezone() {
  return useContext(TzContext)
}

function getInitialTz(): Tz {
  if (typeof window === 'undefined') return browserTz()
  const stored = localStorage.getItem('tz')
  // Migrate legacy values to IANA names
  if (!stored || stored === 'local') return browserTz()
  if (stored === 'utc') return 'UTC'
  return stored
}

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [tz, setTzState] = useState<Tz>(getInitialTz)

  function setTz(value: Tz) {
    setTzState(value)
    localStorage.setItem('tz', value)
  }

  return <TzContext.Provider value={{ tz, setTz }}>{children}</TzContext.Provider>
}
