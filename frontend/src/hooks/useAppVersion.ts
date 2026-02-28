import { useEffect, useState } from 'react'
import { getAppVersion } from '@/lib/api'

export function useAppVersion(): string {
  const [version, setVersion] = useState<string>('…')

  useEffect(() => {
    getAppVersion().then((data) => setVersion(data.version))
  }, []) // fetch once on mount — version never changes at runtime

  return version
}
