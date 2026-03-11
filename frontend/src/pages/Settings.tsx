import { useEffect, useState, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HelpPopover } from '@/components/HelpPopover'
import { HelpSheet, HelpSection } from '@/components/HelpSheet'
import { useTheme } from '@/components/ThemeProvider'
import type { ThemeMode } from '@/components/ThemeProvider'
import { useTimezone } from '@/components/TimezoneProvider'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useModelRegistry } from '@/hooks/useModelRegistry'
import { useAppSettings } from '@/hooks/useAppSettings'
import { getGarminStatus, postRetrain } from '@/lib/api'
import type { GarminIngestLogEntry, GarminStatusResponse, RetrainLogEntry } from '@/lib/api'
import { useGarminIngestLog } from '@/hooks/useGarminIngestLog'
import { formatTs } from '@/lib/formatters'
import { allIanaTz } from '@/lib/tz-utils'

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

// Searchable IANA timezone combobox
function TimezoneSelect({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const allTz = useMemo(() => allIanaTz(), [])
  const filtered = useMemo(
    () =>
      query.trim() === ''
        ? allTz
        : allTz.filter((tz) => tz.toLowerCase().includes(query.toLowerCase())),
    [allTz, query],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-56 justify-between font-normal text-sm"
        >
          <span className="truncate">{value}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="ml-2 h-4 w-4 shrink-0 opacity-50"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b px-3 py-2">
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search timezone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <ul className="max-h-60 overflow-y-auto py-1 text-sm">
          {filtered.length === 0 && <li className="px-3 py-2 text-muted-foreground">No results</li>}
          {filtered.map((tz) => (
            <li
              key={tz}
              className={`flex cursor-pointer items-center px-3 py-1.5 hover:bg-accent hover:text-accent-foreground ${tz === value ? 'font-medium' : ''}`}
              onClick={() => {
                onChange(tz)
                setOpen(false)
                setQuery('')
              }}
            >
              {tz === value && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mr-2 h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {tz !== value && <span className="mr-2 w-3.5 shrink-0" />}
              {tz}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
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
  const {
    settings: appSettings,
    loading: settingsLoading,
    saving: settingsSaving,
    load: loadSettings,
    save: saveSetting,
  } = useAppSettings()

  // Local editable state for autoresearcher settings
  const [arEnabled, setArEnabled] = useState(false)
  const [arOllamaUrl, setArOllamaUrl] = useState('http://localhost:11434')
  const [arOllamaModel, setArOllamaModel] = useState('llama3.1:8b')
  const [arSaveMsg, setArSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    getGarminStatus()
      .then(setGarminStatus)
      .catch(() => {})
    void loadSettings()
  }, [loadSettings])

  // Sync local AR state when settings load
  useEffect(() => {
    if (appSettings) {
      setArEnabled(appSettings['autoresearcher_enabled'] === 'true')
      if (appSettings['autoresearcher_ollama_url'])
        setArOllamaUrl(appSettings['autoresearcher_ollama_url'])
      if (appSettings['autoresearcher_ollama_model'])
        setArOllamaModel(appSettings['autoresearcher_ollama_model'])
    }
  }, [appSettings])

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

  async function handleArSave() {
    setArSaveMsg(null)
    try {
      await saveSetting('autoresearcher_enabled', arEnabled ? 'true' : 'false')
      await saveSetting('autoresearcher_ollama_url', arOllamaUrl)
      await saveSetting('autoresearcher_ollama_model', arOllamaModel)
      setArSaveMsg('Settings saved.')
    } catch {
      setArSaveMsg('Failed to save — check that the backend is reachable.')
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
                  <li>Last 6 glucose readings (25-minute window)</li>
                  <li>Rate of change</li>
                  <li>Time of day and day of week</li>
                  <li>Insulin on Board (4-hour bilinear decay model)</li>
                  <li>Carbs on Board (2-hour linear absorption from logged meals)</li>
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
            <TimezoneSelect value={tz} onChange={setTz} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Autoresearcher
            <HelpPopover title="Autoresearcher">
              <p>
                The Autoresearcher autonomously proposes, evaluates, and promotes improvements to
                the glucose forecasting model using a locally-hosted LLM (Ollama). Each experiment
                tries a different algorithm or feature set, measured with walk-forward
                cross-validation against your CGM history. Only models that improve <em>all</em>{' '}
                forecast horizons are promoted.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Requires Ollama to be running when triggered. Runs are always ad-hoc — use the
                Research page to start a run.
              </p>
            </HelpPopover>
          </CardTitle>
          <CardDescription>
            Autonomous model improvement via a self-hosted LLM. Runs on demand — Ollama need not be
            running continuously.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={arEnabled}
                    onChange={(e) => setArEnabled(e.target.checked)}
                  />
                  <div className="peer h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-primary after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                  <span className="ml-2 text-sm">Enable Autoresearcher</span>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Ollama URL
                  </label>
                  <Input
                    value={arOllamaUrl}
                    onChange={(e) => setArOllamaUrl(e.target.value)}
                    disabled={!arEnabled}
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Model
                  </label>
                  <Input
                    value={arOllamaModel}
                    onChange={(e) => setArOllamaModel(e.target.value)}
                    disabled={!arEnabled}
                    placeholder="llama3.1:8b"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={() => void handleArSave()} disabled={settingsSaving}>
                  {settingsSaving ? 'Saving…' : 'Save'}
                </Button>
                {arSaveMsg && <span className="text-xs text-muted-foreground">{arSaveMsg}</span>}
              </div>
            </>
          )}
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
