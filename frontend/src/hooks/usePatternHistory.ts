import { useCallback, useEffect, useState } from 'react'

import { getPatternHistory, type PatternHistoryResponse } from '@/lib/api'

interface PatternHistoryData {
  history: PatternHistoryResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function usePatternHistory(): PatternHistoryData {
  const [history, setHistory] = useState<PatternHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setHistory(await getPatternHistory())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pattern history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { history, loading, error, refresh: fetchData }
}
