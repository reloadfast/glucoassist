import { useCallback, useEffect, useState } from 'react'

import { getHealthLog, type HealthMetricOut } from '@/lib/api'

const LIMIT = 100

interface HealthLogData {
  entries: HealthMetricOut[]
  loading: boolean
  error: string | null
  hasMore: boolean
  refresh: () => void
  loadMore: () => void
}

export function useHealthLog(): HealthLogData {
  const [entries, setEntries] = useState<HealthMetricOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getHealthLog({ limit: LIMIT })
      setEntries(data.entries)
      setHasMore(data.entries.length >= LIMIT)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health log')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cursor = entries.at(-1)?.timestamp
      const data = await getHealthLog({ limit: LIMIT, before: cursor })
      setEntries((prev) => [...prev, ...data.entries])
      setHasMore(data.entries.length >= LIMIT)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more health entries')
    } finally {
      setLoading(false)
    }
  }, [entries])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { entries, loading, error, hasMore, refresh: fetchData, loadMore }
}
