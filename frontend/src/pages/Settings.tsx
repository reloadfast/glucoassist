import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTimezone } from '@/components/TimezoneProvider'
import { useModelRegistry } from '@/hooks/useModelRegistry'
import { getGarminStatus, postRetrain } from '@/lib/api'
import type { GarminStatusResponse, RetrainLogEntry } from '@/lib/api'
import { formatTs } from '@/lib/formatters'

function RetrainLogRow({ entry }: { entry: RetrainLogEntry }) {
  const { tz } = useTimezone()
  const maes =
    entry.mae_h30 != null ? `${entry.mae_h30} / ${entry.mae_h60} / ${entry.mae_h120} mg/dL` : '—'
  return (
    <tr className="border-b last:border-0 text-sm">
      <td className="py-2 pr-4 text-muted-foreground">{formatTs(entry.triggered_at, tz)}</td>
      <td className="py-2 pr-4 capitalize">{entry.trigger_source}</td>
      <td className="py-2 pr-4">{entry.success ? 'Yes' : 'No'}</td>
      <td className="py-2 pr-4 tabular-nums">{maes}</td>
      <td className="py-2">{entry.promoted ? 'Promoted' : '—'}</td>
    </tr>
  )
}

export default function Settings() {
  const { meta, retrainLog, loading, refresh } = useModelRegistry()
  const { tz, setTz } = useTimezone()
  const [retraining, setRetraining] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [garminStatus, setGarminStatus] = useState<GarminStatusResponse | null>(null)

  useEffect(() => {
    getGarminStatus()
      .then(setGarminStatus)
      .catch(() => {})
  }, [])

  async function handleRetrain() {
    setRetraining(true)
    setMsg(null)
    try {
      await postRetrain()
      setMsg('Retrain started in background. Refresh in a few minutes to see results.')
    } catch {
      setMsg('Failed to trigger retrain — check that the backend is reachable.')
    } finally {
      setRetraining(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Forecast Model</CardTitle>
          <CardDescription>
            Ridge regression trained on your CGM history. Models are retrained automatically every
            24 hours and only promoted when the new model improves accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm max-w-md">
              <dt className="text-muted-foreground">Last trained</dt>
              <dd>{meta?.last_trained ? formatTs(meta.last_trained, tz) : '—'}</dd>
              <dt className="text-muted-foreground">Training samples</dt>
              <dd>{meta?.training_samples ?? '—'}</dd>
              <dt className="text-muted-foreground">MAE (30 / 60 / 120 min)</dt>
              <dd className="tabular-nums">
                {meta?.mae_per_horizon
                  ? `${meta.mae_per_horizon['h30']} / ${meta.mae_per_horizon['h60']} / ${meta.mae_per_horizon['h120']} mg/dL`
                  : '—'}
              </dd>
            </dl>
          )}
          <div className="flex gap-3 items-center flex-wrap">
            <Button
              variant="outline"
              size="sm"
              disabled={retraining}
              onClick={() => void handleRetrain()}
            >
              {retraining ? 'Starting…' : 'Retrain Now'}
            </Button>
            <Button variant="ghost" size="sm" onClick={refresh}>
              Refresh
            </Button>
          </div>
          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retrain Log</CardTitle>
          <CardDescription>Last 20 training events</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : retrainLog && retrainLog.entries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left text-muted-foreground font-medium">Time</th>
                    <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                      Source
                    </th>
                    <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                      Success
                    </th>
                    <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                      MAE (30/60/120)
                    </th>
                    <th className="py-2 text-left text-muted-foreground font-medium">Promoted</th>
                  </tr>
                </thead>
                <tbody>
                  {retrainLog.entries.map((e) => (
                    <RetrainLogRow key={e.id} entry={e} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No retrain events yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Garmin Integration</CardTitle>
          <CardDescription>
            Automatically ingests resting HR, weight, sleep hours, and stress level once per hour.
            Configure via environment variables — credentials are never stored in the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {garminStatus ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm max-w-md">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {garminStatus.enabled ? (
                  <span className="text-green-600 font-medium">Enabled</span>
                ) : (
                  <span className="text-muted-foreground">Disabled</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Account</dt>
              <dd>
                {garminStatus.username_configured ? (
                  <span className="text-green-600">Configured</span>
                ) : (
                  <span className="text-muted-foreground">Not configured</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Poll interval</dt>
              <dd>{garminStatus.interval_seconds / 60} min</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Set <code>GARMIN_ENABLED</code>, <code>GARMIN_USERNAME</code>, and{' '}
            <code>GARMIN_PASSWORD</code> environment variables to activate.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display</CardTitle>
          <CardDescription>Timestamp display preference across all pages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-sm">Timezone</span>
            <Select value={tz} onValueChange={(v) => setTz(v as 'local' | 'utc')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local time</SelectItem>
                <SelectItem value="utc">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
