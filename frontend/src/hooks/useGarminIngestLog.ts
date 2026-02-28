import { useEffect, useState } from 'react'

import { getGarminIngestLog } from '@/lib/api'
import type { GarminIngestLogEntry } from '@/lib/api'

interface UseGarminIngestLogResult {
  entries: GarminIngestLogEntry[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useGarminIngestLog(limit = 30): UseGarminIngestLogResult {
  const [entries, setEntries] = useState<GarminIngestLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getGarminIngestLog(limit)
        if (!cancelled) {
          setEntries(data.entries)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [limit, tick])

  return { entries, loading, error, refresh: () => setTick((t) => t + 1) }
}
