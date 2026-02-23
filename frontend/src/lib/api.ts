const BASE = '/api/v1'

export interface GlucoseReading {
  id: number
  timestamp: string
  glucose_mg_dl: number
  trend_arrow: string | null
  source: string
  device_id: string | null
  created_at: string
}

export interface GlucoseListResponse {
  readings: GlucoseReading[]
  count: number
}

export interface SummaryResponse {
  latest_reading: GlucoseReading | null
  avg_glucose: number | null
  min_glucose: number | null
  max_glucose: number | null
  time_in_range_pct: number | null
  reading_count: number
}

export interface InsulinDoseCreate {
  timestamp: string
  units: number
  type: 'rapid' | 'long'
  notes?: string
}

export interface MealCreate {
  timestamp: string
  carbs_g: number
  label?: string
  notes?: string
}

export interface HealthMetricCreate {
  timestamp: string
  heart_rate_bpm?: number
  weight_kg?: number
  activity_type?: string
  activity_minutes?: number
  notes?: string
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export function getGlucoseSummary(): Promise<SummaryResponse> {
  return apiFetch<SummaryResponse>('/summary')
}

export function getGlucoseReadings(params?: {
  from?: string
  to?: string
  limit?: number
}): Promise<GlucoseListResponse> {
  const qs = new URLSearchParams()
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const query = qs.toString()
  return apiFetch<GlucoseListResponse>(`/glucose${query ? `?${query}` : ''}`)
}

export function postInsulin(data: InsulinDoseCreate): Promise<unknown> {
  return apiFetch('/insulin', { method: 'POST', body: JSON.stringify(data) })
}

export function postMeal(data: MealCreate): Promise<unknown> {
  return apiFetch('/meal', { method: 'POST', body: JSON.stringify(data) })
}

export function postHealth(data: HealthMetricCreate): Promise<unknown> {
  return apiFetch('/health', { method: 'POST', body: JSON.stringify(data) })
}
