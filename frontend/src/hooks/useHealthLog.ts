import { useCallback, useEffect, useState } from 'react'

import { getHealthLog, type HealthMetricOut } from '@/lib/api'

interface HealthLogData {
  entries: HealthMetricOut[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useHealthLog(): HealthLogData {
  const [entries, setEntries] = useState<HealthMetricOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getHealthLog({ limit: 100 })
      setEntries(data.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health log')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { entries, loading, error, refresh: fetchData }
}
