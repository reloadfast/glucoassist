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
import { HelpPopover } from '@/components/HelpPopover'
import { HelpSheet, HelpSection } from '@/components/HelpSheet'
import { useTheme } from '@/components/ThemeProvider'
import type { ThemeMode } from '@/components/ThemeProvider'
import { useTimezone } from '@/components/TimezoneProvider'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useModelRegistry } from '@/hooks/useModelRegistry'
import { getGarminStatus, postRetrain } from '@/lib/api'
import type { GarminIngestLogEntry, GarminStatusResponse, RetrainLogEntry } from '@/lib/api'
import { useGarminIngestLog } from '@/hooks/useGarminIngestLog'
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

const OUTCOME_STYLES: Record<string, string> = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  empty: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  skipped: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  auth_error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  rate_limited: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  connection_error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const style = OUTCOME_STYLES[outcome] ?? OUTCOME_STYLES.error
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {outcome.replace('_', ' ')}
    </span>
  )
}

function GarminIngestLogTable({
  entries,
  loading,
}: {
  entries: GarminIngestLogEntry[]
  loading: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  if (!expanded) {
    return (
      <button
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setExpanded(true)}
        aria-label="Show recent ingest runs"
      >
        Show recent ingest runs
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Recent ingest runs</span>
        <button
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setExpanded(false)}
        >
          Hide
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No ingest runs recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left pb-1 pr-3 font-normal">Date</th>
                <th className="text-left pb-1 pr-3 font-normal">Outcome</th>
                <th className="text-left pb-1 pr-3 font-normal">Fields</th>
                <th className="text-left pb-1 font-normal">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">
                    {e.target_date}
                  </td>
                  <td className="py-1 pr-3 whitespace-nowrap">
                    <OutcomeBadge outcome={e.outcome} />
                    {e.retry_count > 0 && (
                      <span className="ml-1 text-muted-foreground">×{e.retry_count + 1}</span>
                    )}
                  </td>
                  <td className="py-1 pr-3 text-muted-foreground">{e.fields_populated ?? '—'}</td>
                  <td
                    className="py-1 text-muted-foreground max-w-[200px] truncate"
                    title={e.error_detail ?? ''}
                  >
                    {e.error_detail ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { meta, retrainLog, loading, refresh } = useModelRegistry()
  const { tz, setTz } = useTimezone()
  const { theme, setTheme } = useTheme()
  const version = useAppVersion()
  const [retraining, setRetraining] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [garminStatus, setGarminStatus] = useState<GarminStatusResponse | null>(null)
  const garminLog = useGarminIngestLog(20)

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
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how the colour theme is applied across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label htmlFor="theme-select" className="text-sm font-medium min-w-[80px]">
              Theme
            </label>
            <Select value={theme} onValueChange={(v) => setTheme(v as ThemeMode)}>
              <SelectTrigger id="theme-select" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System (follows OS)</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>System mode</strong> follows your OS or browser preference and switches
            automatically if your device changes theme (e.g. at sunset via macOS automatic
            appearance). The header icon cycles through modes: <em>System → Light → Dark</em>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Forecast Model
            <HelpSheet title="About this model" variant="link" triggerLabel="About this model">
              <HelpSection title="What the forecast does">
                <p>
                  Predicts your glucose level at 30, 60, and 120 minutes from now using Ridge
                  regression models trained on your own CGM history.
                </p>
              </HelpSection>
              <HelpSection title="What feeds it">
                <ul className="space-y-1 list-disc list-inside">
                  <li>Last 6 glucose readings (30-minute window)</li>
                  <li>Rate of change</li>
                  <li>Time of day and day of week</li>
                  <li>Insulin on Board (65-min linear decay)</li>
                </ul>
              </HelpSection>
              <HelpSection title="Model promotion logic">
                <p>
                  A new model only replaces the live model if its mean MAE strictly improves across
                  all three horizons. The last 50 training events are kept in the registry for
                  review.
                </p>
              </HelpSection>
              <HelpSection title="Retraining">
                <p>
                  Models are retrained automatically every 24 hours when new data accumulates. You
                  can also trigger retraining manually using the button below. Training requires a
                  minimum of 288 readings (one full day of CGM data).
                </p>
              </HelpSection>
              <HelpSection title="Limitations">
                <p>
                  Decision-support only. The model cannot account for unlogged meals, sensor lag, or
                  unusual physiological events. Always apply clinical judgement.
                </p>
              </HelpSection>
            </HelpSheet>
          </CardTitle>
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
              <dt className="text-muted-foreground flex items-center gap-1">
                Last trained
                <HelpPopover title="Last trained">
                  <p>
                    The timestamp of the most recent successful training run. The model is
                    automatically retrained when enough new data accumulates. You can also trigger
                    retraining manually.
                  </p>
                </HelpPopover>
              </dt>
              <dd>{meta?.last_trained ? formatTs(meta.last_trained, tz) : '—'}</dd>
              <dt className="text-muted-foreground flex items-center gap-1">
                Training samples
                <HelpPopover title="Training samples">
                  <p>
                    Total number of 5-minute CGM readings used to train the model. The minimum
                    required for training is 288 (one full day). More data generally means more
                    reliable predictions.
                  </p>
                </HelpPopover>
              </dt>
              <dd>{meta?.training_samples ?? '—'}</dd>
              <dt className="text-muted-foreground flex items-center gap-1">
                MAE (30 / 60 / 120 min)
                <HelpPopover title="Mean Absolute Error (MAE)">
                  <p>
                    The average difference in mg/dL between the model's predictions and your actual
                    glucose values on held-out (validation) data. Lower is better.
                  </p>
                  <p>
                    Longer horizons typically have higher MAE because the future is harder to
                    predict. Compare values across training runs to gauge whether the model is
                    improving.
                  </p>
                </HelpPopover>
              </dt>
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
        <CardContent className="space-y-4">
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
          <p className="text-xs text-muted-foreground">
            Set <code>GARMIN_ENABLED</code>, <code>GARMIN_USERNAME</code>, and{' '}
            <code>GARMIN_PASSWORD</code> environment variables to activate.
          </p>

          <GarminIngestLogTable entries={garminLog.entries} loading={garminLog.loading} />
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
      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
          <CardDescription>Build information for support and bug reports</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-mono">{version === '…' ? 'Loading…' : `v${version}`}</p>
        </CardContent>
      </Card>
    </div>
  )
}
