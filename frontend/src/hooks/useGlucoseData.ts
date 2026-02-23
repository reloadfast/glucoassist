import { useCallback, useEffect, useState } from 'react'
import { subHours } from 'date-fns'

import {
  getGlucoseReadings,
  getGlucoseSummary,
  type GlucoseReading,
  type SummaryResponse,
} from '@/lib/api'

interface GlucoseData {
  summary: SummaryResponse | null
  readings: GlucoseReading[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useGlucoseData(): GlucoseData {
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [readings, setReadings] = useState<GlucoseReading[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const since = subHours(new Date(), 24).toISOString()
      const [summaryData, readingsData] = await Promise.all([
        getGlucoseSummary(),
        getGlucoseReadings({ from: since, limit: 500 }),
      ])
      setSummary(summaryData)
      setReadings(readingsData.readings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    const interval = setInterval(() => void fetchData(), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { summary, readings, loading, error, refresh: fetchData }
}
