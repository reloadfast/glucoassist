import { format } from 'date-fns'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { GlucoseReading } from '@/lib/api'

interface Props {
  readings: GlucoseReading[]
}

export default function GlucoseChart({ readings }: Props) {
  if (readings.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No glucose data for the last 24 hours
      </div>
    )
  }

  const data = [...readings]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((r) => ({
      time: format(new Date(r.timestamp), 'HH:mm'),
      glucose: r.glucose_mg_dl,
    }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
        <YAxis domain={[40, 'auto']} tick={{ fontSize: 11 }} unit=" mg/dL" width={80} />
        <Tooltip formatter={(v) => [`${v as number} mg/dL`, 'Glucose']} />
        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Low', fontSize: 10 }} />
        <ReferenceLine y={180} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'High', fontSize: 10 }} />
        <Line
          type="monotone"
          dataKey="glucose"
          dot={false}
          strokeWidth={2}
          className="stroke-primary"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
