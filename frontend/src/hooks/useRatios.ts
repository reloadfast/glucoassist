import { useCallback, useEffect, useState } from 'react'

import { getRatios, type RatiosResponse } from '@/lib/api'

interface RatiosData {
  ratios: RatiosResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useRatios(days = 90): RatiosData {
  const [ratios, setRatios] = useState<RatiosResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRatios(await getRatios(days))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ratios')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { ratios, loading, error, refresh: fetchData }
}
