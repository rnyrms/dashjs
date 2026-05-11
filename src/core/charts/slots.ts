// Per-chart-type slot schemas. A chart's "shape" is declared here: how many
// dimension fields it accepts, how many metric fields, and what each one is
// for. The Setup tab renders inputs dynamically from this schema; the data
// pipeline (CSV path / DashJsDataSource adapter) reads slot values via
// readSlot() with legacy-config fallback.

import type { ChartType, AggregationMode, ChartConfig } from '../domain'
import type { FieldType } from '../types'

export type SlotKind = 'dimension' | 'metric'

export interface SlotSpec {
  /** Stable key — used as the entry name in `ChartConfig.slots`. */
  id: string
  /** User-facing label in the Setup tab. */
  label: string
  kind: SlotKind
  /** Optional hint — if present, the picker filters to fields of these types. */
  fieldTypes?: FieldType[]
  required?: boolean
}

export interface ChartTypeSchema {
  slots: SlotSpec[]
}

const d = (id: string, label: string, opts: { required?: boolean; fieldTypes?: FieldType[] } = {}): SlotSpec =>
  ({ id, label, kind: 'dimension', required: opts.required, fieldTypes: opts.fieldTypes })
const m = (id: string, label: string, required = true): SlotSpec =>
  ({ id, label, kind: 'metric', required })

// Schemas match the Highcharts series shape required for each type:
//   - `[name, y]` shape       → 1 dim + 1 metric
//   - stacked variants        → 1 dim + 1 breakdown + 1 metric
//   - xy / xyz numeric        → 0 dim + 2-3 metrics (scatter/bubble)
//   - 2D matrix               → 2 dims + 1 metric (heatmap)
//   - hierarchical            → 1-2 dims + 1 metric (treemap, sunburst)
//   - flow                    → 2 dims (from/to) + 1 metric (sankey)
//   - scalar                  → 0 dim + 1 metric (kpi, gauge)
//   - events                  → 1 dim, no metric (timeline)
export const CHART_TYPE_SCHEMAS: Record<ChartType, ChartTypeSchema> = {
  // Bar family — `[name, y]`
  bar:                  { slots: [d('dimension', 'Dimension', { required: true }), m('metric', 'Metric')] },
  horizontalBar:        { slots: [d('dimension', 'Dimension', { required: true }), m('metric', 'Metric')] },
  stackedBar:           { slots: [d('dimension', 'Dimension', { required: true }), d('breakdown', 'Breakdown'), m('metric', 'Metric')] },
  stackedBarPercent:    { slots: [d('dimension', 'Dimension', { required: true }), d('breakdown', 'Breakdown'), m('metric', 'Metric')] },
  stackedHorizontalBar: { slots: [d('dimension', 'Dimension', { required: true }), d('breakdown', 'Breakdown'), m('metric', 'Metric')] },
  lollipop:             { slots: [d('dimension', 'Dimension', { required: true }), m('metric', 'Metric')] },
  // Line family — `[x, y]`; optional breakdown produces multi-series.
  line:                 { slots: [d('dimension', 'Dimension', { required: true }), d('breakdown', 'Breakdown'), m('metric', 'Metric')] },
  spline:               { slots: [d('dimension', 'Dimension', { required: true }), d('breakdown', 'Breakdown'), m('metric', 'Metric')] },
  area:                 { slots: [d('dimension', 'Dimension', { required: true }), d('breakdown', 'Breakdown'), m('metric', 'Metric')] },
  areaSpline:           { slots: [d('dimension', 'Dimension', { required: true }), d('breakdown', 'Breakdown'), m('metric', 'Metric')] },
  stackedArea:          { slots: [d('dimension', 'Dimension', { required: true }), d('breakdown', 'Breakdown', { required: true }), m('metric', 'Metric')] },
  // Pie family — `[name, y]`
  pie:                  { slots: [d('dimension', 'Dimension', { required: true }), m('metric', 'Metric')] },
  donut:                { slots: [d('dimension', 'Dimension', { required: true }), m('metric', 'Metric')] },
  semicircle:           { slots: [d('dimension', 'Dimension', { required: true }), m('metric', 'Metric')] },
  // variablePie needs `[name, y, z]` — angle metric + radius metric.
  variablePie:          { slots: [d('dimension', 'Dimension', { required: true }), m('metric', 'Slice angle'), m('sizeMetric', 'Slice radius')] },
  // Scatter family — both axes numeric; dim optional series breakdown.
  scatter:              { slots: [m('xMetric', 'X axis'), m('yMetric', 'Y axis'), d('breakdown', 'Breakdown')] },
  bubble:               { slots: [m('xMetric', 'X axis'), m('yMetric', 'Y axis'), m('sizeMetric', 'Bubble size'), d('breakdown', 'Breakdown')] },
  // Hierarchy / matrix
  treemap:              { slots: [d('dimension', 'Dimension', { required: true }), m('metric', 'Metric')] },
  heatmap:              { slots: [d('xDimension', 'X axis', { required: true }), d('yDimension', 'Y axis', { required: true }), m('metric', 'Metric')] },
  sunburst:             { slots: [d('dimension', 'Outer ring', { required: true }), d('dimension2', 'Inner ring'), m('metric', 'Metric')] },
  // Flow / specialty
  funnel:               { slots: [d('dimension', 'Stage', { required: true }), m('metric', 'Metric')] },
  pyramid:              { slots: [d('dimension', 'Stage', { required: true }), m('metric', 'Metric')] },
  sankey:               { slots: [d('source', 'From', { required: true }), d('target', 'To', { required: true }), m('metric', 'Flow value')] },
  // Timeline carries event labels only — no numeric metric.
  timeline:             { slots: [d('dimension', 'Event', { required: true, fieldTypes: ['date'] })] },
  wordcloud:            { slots: [d('dimension', 'Term', { required: true }), m('metric', 'Weight')] },
  // Gauge / KPI are scalar — single metric, no dim.
  gauge:                { slots: [m('metric', 'Metric')] },
  waterfall:            { slots: [d('dimension', 'Step', { required: true }), m('metric', 'Change')] },
  kpi:                  { slots: [m('metric', 'Metric')] },
  table:                { slots: [d('dimension', 'Dimension', { required: true }), m('metric', 'Metric')] },
}

/**
 * Read a slot's current value off a chart's config. Falls back to the legacy
 * `dimension` / `aggregation` fields so dashboards saved before slots existed
 * keep working.
 */
export function readSlot(
  config: ChartConfig | undefined,
  slotId: string,
): { fieldId?: string; aggregation?: AggregationMode } {
  const slotVal = config?.slots?.[slotId]
  if (slotVal) return slotVal
  // Legacy mappings — only fire for the canonical slot names.
  if (slotId === 'dimension' && config?.dimension) {
    return { fieldId: config.dimension.questionCode }
  }
  if (slotId === 'metric' && config?.aggregation) {
    return { aggregation: config.aggregation }
  }
  return {}
}

/** Aggregation modes that require a numeric measure field to make sense. */
export const AGG_REQUIRES_FIELD: Record<AggregationMode, boolean> = {
  count: false,
  percentage: false,
  sum: true,
  mean: true,
}
