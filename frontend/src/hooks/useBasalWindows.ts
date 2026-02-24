import { useCallback, useEffect, useState } from 'react'

import { useTimezone } from '@/components/TimezoneProvider'
import { getBasalWindows, type BasalWindowResponse } from '@/lib/api'

interface BasalWindowsData {
  data: BasalWindowResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useBasalWindows(): BasalWindowsData {
  const [data, setData] = useState<BasalWindowResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { tz } = useTimezone()

  const ianaZone =
    tz === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getBasalWindows(ianaZone))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load basal windows')
    } finally {
      setLoading(false)
    }
  }, [ianaZone])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, loading, error, refresh: fetchData }
}
