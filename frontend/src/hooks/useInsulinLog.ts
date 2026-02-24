import { useCallback, useEffect, useState } from 'react'

import { getInsulinLog, type InsulinDoseOut } from '@/lib/api'

const LIMIT = 100

interface InsulinLogData {
  entries: InsulinDoseOut[]
  loading: boolean
  error: string | null
  hasMore: boolean
  refresh: () => void
  loadMore: () => void
}

export function useInsulinLog(): InsulinLogData {
  const [entries, setEntries] = useState<InsulinDoseOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getInsulinLog({ limit: LIMIT })
      setEntries(data.entries)
      setHasMore(data.entries.length >= LIMIT)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insulin log')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cursor = entries.at(-1)?.timestamp
      const data = await getInsulinLog({ limit: LIMIT, before: cursor })
      setEntries((prev) => [...prev, ...data.entries])
      setHasMore(data.entries.length >= LIMIT)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more insulin entries')
    } finally {
      setLoading(false)
    }
  }, [entries])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { entries, loading, error, hasMore, refresh: fetchData, loadMore }
}
