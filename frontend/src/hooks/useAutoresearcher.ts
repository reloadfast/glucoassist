import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteAutoresearcherRun,
  getAutoresearcherLog,
  getAutoresearcherStatus,
  postAutoresearcherRun,
  type AutoresearcherLogEntry,
  type AutoresearcherStatus,
} from '@/lib/api'

const POLL_INTERVAL_MS = 5000

export function useAutoresearcher() {
  const [status, setStatus] = useState<AutoresearcherStatus | null>(null)
  const [log, setLog] = useState<AutoresearcherLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const s = await getAutoresearcherStatus()
      setStatus(s)
      return s
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch status')
      return null
    }
  }, [])

  const fetchLog = useCallback(async () => {
    try {
      const entries = await getAutoresearcherLog(50)
      setLog(entries)
    } catch {
      // non-fatal
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      const s = await fetchStatus()
      if (s?.state !== 'running') {
        stopPolling()
        await fetchLog()
      }
    }, POLL_INTERVAL_MS)
  }, [fetchStatus, fetchLog]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchLog()
    return stopPolling
  }, [fetchStatus, fetchLog, stopPolling])

  // Auto-start polling if already running when hook mounts
  useEffect(() => {
    if (status?.state === 'running') {
      startPolling()
    }
  }, [status?.state, startPolling])

  const startRun = useCallback(
    async (nExperiments: number) => {
      setStarting(true)
      setError(null)
      try {
        await postAutoresearcherRun(nExperiments)
        await fetchStatus()
        startPolling()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start run')
        throw e
      } finally {
        setStarting(false)
      }
    },
    [fetchStatus, startPolling],
  )

  const cancelRun = useCallback(async () => {
    try {
      await deleteAutoresearcherRun()
      await fetchStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel run')
    }
  }, [fetchStatus])

  return {
    status,
    log,
    error,
    starting,
    startRun,
    cancelRun,
    refresh: fetchLog,
  }
}
