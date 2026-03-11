import { useCallback, useState } from 'react'
import { getAppSettings, putAppSetting, type AppSettings } from '@/lib/api'

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAppSettings()
      setSettings(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (key: string, value: string) => {
    setSaving(true)
    setError(null)
    try {
      await putAppSetting(key, value)
      setSettings((prev) => (prev ? { ...prev, [key]: value } : { [key]: value }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save setting')
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  return { settings, loading, error, saving, load, save }
}
