import { useCallback, useEffect, useState } from 'react'

import { getInsulinLog, type InsulinDoseOut } from '@/lib/api'

interface InsulinLogData {
  entries: InsulinDoseOut[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useInsulinLog(): InsulinLogData {
  const [entries, setEntries] = useState<InsulinDoseOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getInsulinLog({ limit: 100 })
      setEntries(data.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insulin log')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { entries, loading, error, refresh: fetchData }
}
