import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { HelpSheet, HelpSection } from '@/components/HelpSheet'
import { useAutoresearcher } from '@/hooks/useAutoresearcher'
import { useTimezone } from '@/components/TimezoneProvider'
import { formatTs } from '@/lib/formatters'

function StatusBadge({ state }: { state: string }) {
  if (state === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        Running
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
        Error
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      Idle
    </span>
  )
}

export default function Research() {
  const { status, log, error, starting, startRun, cancelRun } = useAutoresearcher()
  const { tz } = useTimezone()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nExperiments, setNExperiments] = useState(10)

  const isRunning = status?.state === 'running'
  const progress = status?.progress ?? 0
  const total = status?.total ?? 0

  async function handleStart() {
    setDialogOpen(false)
    try {
      await startRun(nExperiments)
    } catch {
      // error is set in hook
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Research</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Autonomous forecast model improvement — powered by a self-hosted LLM.
          </p>
        </div>
        <HelpSheet
          title="How the Research Loop Works"
          trigger={
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              How it works
            </Button>
          }
        >
          <HelpSection title="Overview">
            <p>
              The Autoresearcher is an autonomous agent that reads a research program describing
              your current forecasting baselines, proposes one experiment at a time (different
              algorithms, feature sets, or hyperparameters), evaluates it with walk-forward
              cross-validation on your CGM history, and promotes the model only if it improves{' '}
              <em>all four</em> forecast horizons (30, 60, 90, and 120 minutes).
            </p>
          </HelpSection>
          <HelpSection title="Walk-Forward Cross-Validation">
            <p>
              Each candidate model is evaluated with time-series walk-forward CV: a 14-day training
              window, 7-day validation window, stepping forward 7 days at a time. This mirrors how
              the model will be used in production and prevents data leakage.
            </p>
          </HelpSection>
          <HelpSection title="Promotion Gate">
            <p>
              A candidate is promoted only if it beats the current baseline MAE on{' '}
              <strong>all four horizons simultaneously</strong>. Partial improvement is logged but
              not promoted. The 30-minute horizon is the most clinically important.
            </p>
          </HelpSection>
          <HelpSection title="Ollama Requirement">
            <p>
              The LLM (Ollama) is only needed to <em>propose</em> the next experiment — one call per
              experiment. The cross-validation runs entirely on local compute without Ollama. If
              Ollama is unreachable when you start a run, the run will fail fast with a clear error.
            </p>
          </HelpSection>
          <HelpSection title="Clinical Safety Note">
            <p className="text-xs text-muted-foreground">
              Decision-support only — always follow guidance from your healthcare team.
            </p>
          </HelpSection>
        </HelpSheet>
      </div>

      {/* Status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Status
                <StatusBadge state={status?.state ?? 'idle'} />
              </CardTitle>
              {isRunning && (
                <CardDescription>
                  Experiment {progress} of {total}
                </CardDescription>
              )}
            </div>
            <div className="flex gap-2">
              {isRunning ? (
                <Button variant="outline" size="sm" onClick={() => void cancelRun()}>
                  Cancel
                </Button>
              ) : (
                <Button size="sm" onClick={() => setDialogOpen(true)} disabled={starting}>
                  {starting ? 'Starting…' : 'Run Now'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {isRunning && total > 0 && (
          <CardContent>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.round((progress / total) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground text-right">
              {Math.round((progress / total) * 100)}%
            </p>
          </CardContent>
        )}
        {status?.state === 'error' && status.error_message && (
          <CardContent>
            <p className="text-sm text-destructive">{status.error_message}</p>
          </CardContent>
        )}
        {error && (
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        )}
      </Card>

      {/* Results table */}
      <Card>
        <CardHeader>
          <CardTitle>Experiment Log</CardTitle>
          <CardDescription>
            All past experiments — most recent first. Promoted models replace the active forecast
            model on the next retrain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No experiments yet. Click <strong>Run Now</strong> to start.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">#</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Description</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground tabular-nums">
                      MAE 30/60/90/120
                    </th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Promoted</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Elapsed</th>
                    <th className="pb-2 font-medium text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground">{entry.experiment_id}</td>
                      <td className="py-2 pr-4 max-w-xs truncate" title={entry.description}>
                        {entry.description}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-xs">
                        {entry.mae_30 != null
                          ? `${entry.mae_30.toFixed(1)} / ${entry.mae_60?.toFixed(1)} / ${entry.mae_90?.toFixed(1)} / ${entry.mae_120?.toFixed(1)}`
                          : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        {entry.promoted ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ Yes
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground tabular-nums text-xs">
                        {entry.elapsed_s != null ? `${entry.elapsed_s.toFixed(0)}s` : '—'}
                      </td>
                      <td className="py-2 text-muted-foreground text-xs">
                        {entry.timestamp ? formatTs(entry.timestamp, tz) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Research Run</DialogTitle>
            <DialogDescription>
              The Autoresearcher will propose and evaluate this many experiments sequentially.
              Ollama must be running and reachable at the configured URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Number of experiments</label>
            <Input
              type="number"
              min={1}
              max={50}
              value={nExperiments}
              onChange={(e) => setNExperiments(Number(e.target.value))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleStart()}>Start</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
