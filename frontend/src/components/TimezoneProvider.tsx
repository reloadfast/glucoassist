import { createContext, useContext, useState } from 'react'

export type Tz = 'local' | 'utc'

interface TzContextValue {
  tz: Tz
  setTz: (tz: Tz) => void
}

const TzContext = createContext<TzContextValue>({
  tz: 'local',
  setTz: () => {},
})

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider is intentional
export function useTimezone() {
  return useContext(TzContext)
}

function getInitialTz(): Tz {
  if (typeof window === 'undefined') return 'local'
  const stored = localStorage.getItem('tz')
  return stored === 'utc' ? 'utc' : 'local'
}

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [tz, setTzState] = useState<Tz>(getInitialTz)

  function setTz(value: Tz) {
    setTzState(value)
    localStorage.setItem('tz', value)
  }

  return <TzContext.Provider value={{ tz, setTz }}>{children}</TzContext.Provider>
}
