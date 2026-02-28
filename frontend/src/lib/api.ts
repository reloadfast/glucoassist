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
  iob_units: number | null
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
  food_item_ids?: number[]
}

export interface HealthMetricCreate {
  timestamp: string
  heart_rate_bpm?: number
  weight_kg?: number
  activity_type?: string
  activity_minutes?: number
  sleep_hours?: number
  stress_level?: number
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

export interface WindowStats {
  window_days: number
  reading_count: number
  avg_glucose: number | null
  sd: number | null
  cv_pct: number | null
  tir_pct: number | null
  tbr_pct: number | null
  tar_pct: number | null
  eag: number | null
  hba1c: number | null
}

export interface StatsResponse {
  windows: WindowStats[]
}

export interface HbA1cResponse {
  eag_30d: number | null
  eag_60d: number | null
  eag_90d: number | null
  hba1c_30d: number | null
  hba1c_60d: number | null
  hba1c_90d: number | null
}

export interface PatternItem {
  name: string
  detected: boolean
  description: string
  confidence: number | null
}

export interface PatternsResponse {
  patterns: PatternItem[]
}

export function getAnalyticsStats(): Promise<StatsResponse> {
  return apiFetch<StatsResponse>('/analytics/stats')
}

export function getAnalyticsHbA1c(): Promise<HbA1cResponse> {
  return apiFetch<HbA1cResponse>('/analytics/hba1c')
}

export function getAnalyticsPatterns(): Promise<PatternsResponse> {
  return apiFetch<PatternsResponse>('/analytics/patterns')
}

export interface BackfillResponse {
  status: string
  days: number
  inserted: number
}

export function postBackfill(days = 90): Promise<BackfillResponse> {
  return apiFetch<BackfillResponse>(`/ingest/backfill?days=${days}`, { method: 'POST' })
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export interface HorizonForecast {
  horizon_min: number
  predicted_mg_dl: number
  ci_lower: number
  ci_upper: number
  p_hypo: number
  p_hyper: number
  risk_level: 'low' | 'moderate' | 'high' | 'critical'
}

export interface ModelMeta {
  last_trained: string | null
  training_samples: number | null
  mae_per_horizon: Record<string, number> | null
}

export interface ForecastResponse {
  model_trained: boolean
  forecasts: HorizonForecast[]
  overall_risk: 'low' | 'moderate' | 'high' | 'critical' | 'unknown'
  meta: ModelMeta
}

export function getForecast(): Promise<ForecastResponse> {
  return apiFetch<ForecastResponse>('/forecast')
}

export interface AppVersionResponse {
  status: string
  version: string
  environment: string
}

export function getAppVersion(): Promise<AppVersionResponse> {
  return fetch('/api/health')
    .then((r) => r.json() as Promise<AppVersionResponse>)
    .catch(() => ({ status: 'error', version: 'dev', environment: 'unknown' }))
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

// ─── Ratios (ICR / CF) ─────────────────────────────────────────────────────

export interface RatioEstimate {
  mean: number
  ci_lower: number
  ci_upper: number
  n: number
}

export interface TimeBlockRatio {
  block: string
  icr: RatioEstimate | null
  cf: RatioEstimate | null
  icr_samples: number
  cf_samples: number
  insufficient_data: boolean
}

export interface RatiosResponse {
  blocks: TimeBlockRatio[]
  days_analyzed: number
  disclaimer: string
}

export function getRatios(days = 90): Promise<RatiosResponse> {
  return apiFetch<RatiosResponse>(`/ratios?days=${days}`)
}

// ─── Model registry / retrain ──────────────────────────────────────────────

export interface RetrainLogEntry {
  id: number
  triggered_at: string
  trigger_source: string
  success: boolean
  training_samples: number | null
  mae_h30: number | null
  mae_h60: number | null
  mae_h120: number | null
  promoted: boolean
  notes: string | null
}

export interface RetrainLogResponse {
  entries: RetrainLogEntry[]
}

export interface ModelRegistryVersion {
  version_id: string
  training_samples: number
  mae_per_horizon: Record<string, number>
  promoted: boolean
  trained_at: string
  trigger_source?: string
}

export interface ModelRegistryResponse {
  versions: ModelRegistryVersion[]
}

export function postRetrain(): Promise<{ status: string }> {
  return apiFetch('/forecast/retrain', { method: 'POST' })
}

export function getRetrainLog(limit = 20): Promise<RetrainLogResponse> {
  return apiFetch<RetrainLogResponse>(`/forecast/retrain/log?limit=${limit}`)
}

export function getModelRegistry(): Promise<ModelRegistryResponse> {
  return apiFetch<ModelRegistryResponse>('/forecast/registry')
}

// ─── Log list + delete ─────────────────────────────────────────────────────

export interface InsulinDoseOut {
  id: number
  timestamp: string
  units: number
  type: 'rapid' | 'long'
  notes: string | null
  created_at: string
}

export interface InsulinListResponse {
  entries: InsulinDoseOut[]
  count: number
}

export interface MealOut {
  id: number
  timestamp: string
  carbs_g: number
  label: string | null
  notes: string | null
  food_item_ids: number[] | null
  created_at: string
}

export interface MealListResponse {
  entries: MealOut[]
  count: number
}

export interface HealthMetricOut {
  id: number
  timestamp: string
  heart_rate_bpm: number | null
  weight_kg: number | null
  activity_type: string | null
  activity_minutes: number | null
  sleep_hours: number | null
  stress_level: number | null
  source: string | null
  notes: string | null
  created_at: string
}

export interface GarminStatusResponse {
  enabled: boolean
  username_configured: boolean
  interval_seconds: number
}

export function getGarminStatus(): Promise<GarminStatusResponse> {
  return apiFetch<GarminStatusResponse>('/garmin/status')
}

export interface HealthMetricListResponse {
  entries: HealthMetricOut[]
  count: number
}

export function getInsulinLog(params?: {
  from?: string
  to?: string
  before?: string
  limit?: number
}): Promise<InsulinListResponse> {
  const qs = new URLSearchParams()
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.before) qs.set('before', params.before)
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const query = qs.toString()
  return apiFetch<InsulinListResponse>(`/insulin${query ? `?${query}` : ''}`)
}

export function getMealLog(params?: {
  from?: string
  to?: string
  before?: string
  limit?: number
}): Promise<MealListResponse> {
  const qs = new URLSearchParams()
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.before) qs.set('before', params.before)
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const query = qs.toString()
  return apiFetch<MealListResponse>(`/meal${query ? `?${query}` : ''}`)
}

export function getHealthLog(params?: {
  from?: string
  to?: string
  before?: string
  limit?: number
}): Promise<HealthMetricListResponse> {
  const qs = new URLSearchParams()
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.before) qs.set('before', params.before)
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const query = qs.toString()
  return apiFetch<HealthMetricListResponse>(`/health${query ? `?${query}` : ''}`)
}

export async function deleteInsulin(id: number): Promise<void> {
  const res = await fetch(`${BASE}/insulin/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`)
}

export async function deleteMeal(id: number): Promise<void> {
  const res = await fetch(`${BASE}/meal/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`)
}

export interface MealResponseData {
  meal: MealOut
  actual_readings: GlucoseReading[]
  glucose_at_meal: number | null
}

export function getMealResponse(mealId: number): Promise<MealResponseData> {
  return apiFetch<MealResponseData>(`/meal/${mealId}/response`)
}

export async function deleteHealth(id: number): Promise<void> {
  const res = await fetch(`${BASE}/health/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`)
}

// ─── Pattern history ───────────────────────────────────────────────────────

export interface PatternHistoryEntry {
  pattern_name: string
  first_detected_at: string
  last_detected_at: string
  detection_count: number
  last_confidence: number | null
}

export interface PatternHistoryResponse {
  history: PatternHistoryEntry[]
}

export function getPatternHistory(): Promise<PatternHistoryResponse> {
  return apiFetch<PatternHistoryResponse>('/analytics/patterns/history')
}

// ─── Recommendations ───────────────────────────────────────────────────────

export interface Recommendation {
  title: string
  reasoning: string
  action: string
  priority: 'high' | 'medium' | 'low'
  linked_patterns: string[]
}

export interface RecommendationsResponse {
  recommendations: Recommendation[]
  patterns_analyzed: number
  detected_count: number
}

export function getRecommendations(): Promise<RecommendationsResponse> {
  return apiFetch<RecommendationsResponse>('/analytics/recommendations')
}

// ─── Basal windows ─────────────────────────────────────────────────────────

export interface BasalWindowBlock {
  block_label: string
  hour_start: number
  hour_end: number
  median: number | null
  p10: number | null
  p25: number | null
  p75: number | null
  p90: number | null
  n: number
  nights: number
}

export interface BasalWindowResponse {
  blocks: BasalWindowBlock[]
  nights_analyzed: number
  tz: string
}

export function getBasalWindows(tz = 'UTC'): Promise<BasalWindowResponse> {
  return apiFetch<BasalWindowResponse>(`/analytics/basal-windows?tz=${encodeURIComponent(tz)}`)
}

// ─── Food library ───────────────────────────────────────────────────────────

export interface FoodItem {
  id: number
  name: string
  carbs_per_100g: number
  default_portion_g: number
  aliases: string[]
  created_at: string
  last_used_at: string | null
  use_count: number
}

export interface FoodItemCreate {
  name: string
  carbs_per_100g: number
  default_portion_g: number
  aliases: string[]
}

export interface FoodItemUpdate {
  name?: string
  carbs_per_100g?: number
  default_portion_g?: number
  aliases?: string[]
}

export interface FoodItemListResponse {
  items: FoodItem[]
  count: number
}

export function getFoodItems(q?: string): Promise<FoodItemListResponse> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : ''
  return apiFetch<FoodItemListResponse>(`/food-items${qs}`)
}

export function createFoodItem(data: FoodItemCreate): Promise<FoodItem> {
  return apiFetch<FoodItem>('/food-items', { method: 'POST', body: JSON.stringify(data) })
}

export function updateFoodItem(id: number, data: FoodItemUpdate): Promise<FoodItem> {
  return apiFetch<FoodItem>(`/food-items/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteFoodItem(id: number): Promise<void> {
  const res = await fetch(`${BASE}/food-items/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`)
}

export interface GarminIngestLogEntry {
  id: number
  run_at: string
  target_date: string
  outcome: string
  fields_populated: string | null
  error_detail: string | null
  retry_count: number
  created_at: string
}

export interface GarminIngestLogResponse {
  entries: GarminIngestLogEntry[]
  count: number
}

export function getGarminIngestLog(limit = 30): Promise<GarminIngestLogResponse> {
  return apiFetch<GarminIngestLogResponse>(`/garmin/ingest-log?limit=${limit}`)
}
