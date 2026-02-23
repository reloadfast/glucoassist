import { useCallback, useEffect, useState } from 'react'

import { getForecast, type ForecastResponse } from '@/lib/api'

interface ForecastData {
  forecast: ForecastResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useForecast(): ForecastData {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getForecast()
      setForecast(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecast')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    const interval = setInterval(() => void fetchData(), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { forecast, loading, error, refresh: fetchData }
}
