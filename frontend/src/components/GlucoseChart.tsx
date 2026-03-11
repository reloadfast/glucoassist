import { addMinutes, format } from 'date-fns'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { HelpPopover } from '@/components/HelpPopover'
import type { GlucoseReading, HorizonForecast } from '@/lib/api'

interface ChartPoint {
  time: string
  glucose?: number
  forecast?: number
  ci_lower?: number
  ci_upper?: number
}

export interface EventMarker {
  id: number
  timestamp: string
  type: 'insulin' | 'meal'
}

interface Props {
  readings: GlucoseReading[]
  forecasts?: HorizonForecast[]
  eventMarkers?: EventMarker[]
}

export default function GlucoseChart({ readings, forecasts = [], eventMarkers = [] }: Props) {
  if (readings.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No glucose data for the last 24 hours
      </div>
    )
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const historicalPoints: ChartPoint[] = sorted.map((r) => ({
    time: format(new Date(r.timestamp), 'HH:mm'),
    glucose: r.glucose_mg_dl,
  }))

  // Bridge: duplicate the last real reading onto the forecast series so the
  // dashed line visually extends from the last real data point
  const lastReading = sorted[sorted.length - 1]
  const lastTime = new Date(lastReading.timestamp)

  const forecastPoints: ChartPoint[] = forecasts.map((f) => ({
    time: format(addMinutes(lastTime, f.horizon_min), 'HH:mm'),
    forecast: f.predicted_mg_dl,
    ci_lower: Math.max(40, f.ci_lower),
    ci_upper: f.ci_upper,
  }))

  const bridgeIdx = historicalPoints.length - 1
  const data: ChartPoint[] = [
    ...historicalPoints.slice(0, bridgeIdx),
    {
      ...historicalPoints[bridgeIdx],
      forecast: lastReading.glucose_mg_dl,
      ci_lower: lastReading.glucose_mg_dl,
      ci_upper: lastReading.glucose_mg_dl,
    },
    ...forecastPoints,
  ]

  const hasForecast = forecasts.length > 0
  const hasMarkers = eventMarkers.length > 0

  return (
    <div>
      <div role="img" aria-label="Glucose readings chart">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis domain={[40, 'auto']} tick={{ fontSize: 11 }} unit=" mg/dL" width={80} />
            <Tooltip
              formatter={(value, name) => {
                const v = value as number
                if (name === 'glucose') return [`${v} mg/dL`, 'Glucose']
                if (name === 'forecast') return [`${v} mg/dL`, 'Forecast']
                if (name === 'ci_upper') return [`${v} mg/dL`, 'CI Upper']
                if (name === 'ci_lower') return [`${v} mg/dL`, 'CI Lower']
                return [String(value), String(name)]
              }}
            />
            <ReferenceLine
              y={70}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: 'Low', fontSize: 10 }}
            />
            <ReferenceLine
              y={180}
              stroke="#f97316"
              strokeDasharray="4 4"
              label={{ value: 'High', fontSize: 10 }}
            />

            {/* CI shaded band — upper area first, then mask with white from below */}
            {hasForecast && (
              <Area
                type="monotone"
                dataKey="ci_upper"
                stroke="none"
                fill="#3b82f6"
                fillOpacity={0.15}
                legendType="none"
                isAnimationActive={false}
                connectNulls
              />
            )}
            {hasForecast && (
              <Area
                type="monotone"
                dataKey="ci_lower"
                stroke="none"
                fill="#ffffff"
                fillOpacity={1}
                legendType="none"
                isAnimationActive={false}
                connectNulls
              />
            )}

            {/* Historical glucose line */}
            <Line
              type="monotone"
              dataKey="glucose"
              dot={false}
              strokeWidth={2}
              className="stroke-primary"
              isAnimationActive={false}
            />

            {/* Forecast dashed extension */}
            {hasForecast && (
              <Line
                type="monotone"
                dataKey="forecast"
                dot={{ r: 3 }}
                strokeWidth={2}
                stroke="#3b82f6"
                strokeDasharray="5 5"
                connectNulls
                isAnimationActive={false}
              />
            )}

            {/* Horizon label markers */}
            {hasForecast &&
              forecasts.map((f) => (
                <ReferenceDot
                  key={`h${f.horizon_min}`}
                  x={format(addMinutes(lastTime, f.horizon_min), 'HH:mm')}
                  y={f.predicted_mg_dl}
                  r={0}
                  label={{
                    value: `${f.horizon_min}m`,
                    position: 'top',
                    fontSize: 9,
                    fill: '#3b82f6',
                  }}
                />
              ))}

            {/* Event markers */}
            {hasMarkers &&
              eventMarkers.map((ev) => (
                <ReferenceLine
                  key={`${ev.type}-${ev.id}`}
                  x={format(new Date(ev.timestamp), 'HH:mm')}
                  stroke={ev.type === 'insulin' ? '#8b5cf6' : '#f59e0b'}
                  strokeDasharray="3 3"
                  label={{
                    value: ev.type === 'insulin' ? 'I' : 'M',
                    position: 'top',
                    fontSize: 10,
                  }}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {hasForecast && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block w-6 border-t-2 border-blue-500 border-dashed"
            aria-hidden="true"
          />
          <span className="inline-flex items-center gap-1">
            Forecast
            <HelpPopover title="Forecast Line">
              <p>
                Dashed line: predicted glucose trajectory. Shaded area: 80% confidence interval —
                the actual reading is expected to land inside this band 4 out of 5 times.
              </p>
              <p>
                Wider shading means more uncertainty. Longer horizons (60, 120 min) are inherently
                less certain than the 30-minute forecast.
              </p>
            </HelpPopover>
          </span>
        </div>
      )}
    </div>
  )
}
