import { useCallback, useEffect, useState } from 'react'

import {
  getAnalyticsHbA1c,
  getAnalyticsPatterns,
  getAnalyticsStats,
  type HbA1cResponse,
  type PatternsResponse,
  type StatsResponse,
} from '@/lib/api'

interface AnalyticsData {
  stats: StatsResponse | null
  hba1c: HbA1cResponse | null
  patterns: PatternsResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useAnalytics(): AnalyticsData {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [hba1c, setHba1c] = useState<HbA1cResponse | null>(null)
  const [patterns, setPatterns] = useState<PatternsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsData, hba1cData, patternsData] = await Promise.all([
        getAnalyticsStats(),
        getAnalyticsHbA1c(),
        getAnalyticsPatterns(),
      ])
      setStats(statsData)
      setHba1c(hba1cData)
      setPatterns(patternsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    const interval = setInterval(() => void fetchData(), 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { stats, hba1c, patterns, loading, error, refresh: fetchData }
}
