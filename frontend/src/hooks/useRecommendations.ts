import { useCallback, useEffect, useState } from 'react'

import { getRecommendations, type RecommendationsResponse } from '@/lib/api'

interface RecommendationsData {
  data: RecommendationsResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useRecommendations(): RecommendationsData {
  const [data, setData] = useState<RecommendationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getRecommendations())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, loading, error, refresh: fetchData }
}
