import { format } from 'date-fns'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { GlucoseReading } from '@/lib/api'

interface Props {
  readings: GlucoseReading[]
}

function glucoseClass(value: number): string {
  if (value < 70) return 'text-red-600 font-semibold'
  if (value > 180) return 'text-orange-500 font-semibold'
  return 'text-green-600'
}

export default function ReadingsTable({ readings }: Props) {
  if (readings.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No readings yet</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Glucose</TableHead>
          <TableHead>Trend</TableHead>
          <TableHead>Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {readings.slice(0, 20).map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-sm text-muted-foreground">
              {format(new Date(r.timestamp), 'MMM d, HH:mm')}
            </TableCell>
            <TableCell className={glucoseClass(r.glucose_mg_dl)}>{r.glucose_mg_dl} mg/dL</TableCell>
            <TableCell>{r.trend_arrow ?? '—'}</TableCell>
            <TableCell className="text-sm text-muted-foreground capitalize">{r.source}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
