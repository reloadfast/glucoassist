import { useCallback, useEffect, useState } from 'react'
import { getFoodItems } from '@/lib/api'
import type { FoodItem } from '@/lib/api'

export function useFoodLibrary() {
  const [items, setItems] = useState<FoodItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getFoodItems()
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load food library')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, refresh: load }
}
