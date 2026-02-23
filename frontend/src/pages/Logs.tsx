import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTimezone } from '@/components/TimezoneProvider'
import { useHealthLog } from '@/hooks/useHealthLog'
import { useInsulinLog } from '@/hooks/useInsulinLog'
import { useMealLog } from '@/hooks/useMealLog'
import { deleteHealth, deleteInsulin, deleteMeal } from '@/lib/api'
import { formatTs } from '@/lib/formatters'

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
      {msg}
    </div>
  )
}

function EmptyMsg({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4 text-center">{text}</p>
}

export default function Logs() {
  const { tz } = useTimezone()
  const insulin = useInsulinLog()
  const meals = useMealLog()
  const health = useHealthLog()

  async function handleDeleteInsulin(id: number) {
    if (!window.confirm('Delete this insulin entry?')) return
    await deleteInsulin(id)
    insulin.refresh()
  }

  async function handleDeleteMeal(id: number) {
    if (!window.confirm('Delete this meal entry?')) return
    await deleteMeal(id)
    meals.refresh()
  }

  async function handleDeleteHealth(id: number) {
    if (!window.confirm('Delete this health entry?')) return
    await deleteHealth(id)
    health.refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Logs</h1>

      <Tabs defaultValue="insulin">
        <TabsList>
          <TabsTrigger value="insulin">Insulin</TabsTrigger>
          <TabsTrigger value="meals">Meals</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="insulin" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Insulin Log</CardTitle>
              <CardDescription>Recent insulin doses</CardDescription>
            </CardHeader>
            <CardContent>
              {insulin.loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : insulin.error ? (
                <ErrorMsg msg={insulin.error} />
              ) : insulin.entries.length === 0 ? (
                <EmptyMsg text="No insulin entries yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Time
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Units
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Type
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Notes
                        </th>
                        <th className="py-2 text-left text-muted-foreground font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {insulin.entries.map((e) => (
                        <tr key={e.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">
                            {formatTs(e.timestamp, tz)}
                          </td>
                          <td className="py-2 pr-4 tabular-nums">{e.units}</td>
                          <td className="py-2 pr-4 capitalize">{e.type}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{e.notes ?? '—'}</td>
                          <td className="py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDeleteInsulin(e.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Meal Log</CardTitle>
              <CardDescription>Recent meal entries</CardDescription>
            </CardHeader>
            <CardContent>
              {meals.loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : meals.error ? (
                <ErrorMsg msg={meals.error} />
              ) : meals.entries.length === 0 ? (
                <EmptyMsg text="No meal entries yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Time
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Carbs (g)
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Label
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Notes
                        </th>
                        <th className="py-2 text-left text-muted-foreground font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {meals.entries.map((e) => (
                        <tr key={e.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">
                            {formatTs(e.timestamp, tz)}
                          </td>
                          <td className="py-2 pr-4 tabular-nums">{e.carbs_g}</td>
                          <td className="py-2 pr-4">{e.label ?? '—'}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{e.notes ?? '—'}</td>
                          <td className="py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDeleteMeal(e.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Health Log</CardTitle>
              <CardDescription>Recent health metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {health.loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : health.error ? (
                <ErrorMsg msg={health.error} />
              ) : health.entries.length === 0 ? (
                <EmptyMsg text="No health entries yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Time
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          HR
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Weight (kg)
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Sleep (h)
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Stress
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Activity
                        </th>
                        <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                          Source
                        </th>
                        <th className="py-2 text-left text-muted-foreground font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.entries.map((e) => (
                        <tr key={e.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">
                            {formatTs(e.timestamp, tz)}
                          </td>
                          <td className="py-2 pr-4 tabular-nums">{e.heart_rate_bpm ?? '—'}</td>
                          <td className="py-2 pr-4 tabular-nums">{e.weight_kg ?? '—'}</td>
                          <td className="py-2 pr-4 tabular-nums">{e.sleep_hours ?? '—'}</td>
                          <td className="py-2 pr-4 tabular-nums">{e.stress_level ?? '—'}</td>
                          <td className="py-2 pr-4">
                            {e.activity_type
                              ? `${e.activity_type}${e.activity_minutes != null ? ` (${e.activity_minutes}min)` : ''}`
                              : '—'}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground capitalize">
                            {e.source ?? '—'}
                          </td>
                          <td className="py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDeleteHealth(e.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
