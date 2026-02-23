import { useCallback, useEffect, useState } from 'react'

import { getMealLog, type MealOut } from '@/lib/api'

interface MealLogData {
  entries: MealOut[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useMealLog(): MealLogData {
  const [entries, setEntries] = useState<MealOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMealLog({ limit: 100 })
      setEntries(data.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meal log')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { entries, loading, error, refresh: fetchData }
}
