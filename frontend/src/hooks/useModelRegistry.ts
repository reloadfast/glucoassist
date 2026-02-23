import { useCallback, useEffect, useState } from 'react'

import {
  getForecast,
  getModelRegistry,
  getRetrainLog,
  type ForecastResponse,
  type ModelRegistryResponse,
  type RetrainLogResponse,
} from '@/lib/api'

interface ModelRegistryData {
  meta: ForecastResponse['meta'] | null
  registry: ModelRegistryResponse | null
  retrainLog: RetrainLogResponse | null
  loading: boolean
  refresh: () => void
}

export function useModelRegistry(): ModelRegistryData {
  const [meta, setMeta] = useState<ForecastResponse['meta'] | null>(null)
  const [registry, setRegistry] = useState<ModelRegistryResponse | null>(null)
  const [retrainLog, setRetrainLog] = useState<RetrainLogResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [fcast, reg, log] = await Promise.all([
        getForecast(),
        getModelRegistry(),
        getRetrainLog(),
      ])
      setMeta(fcast.meta)
      setRegistry(reg)
      setRetrainLog(log)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { meta, registry, retrainLog, loading, refresh: fetchData }
}
