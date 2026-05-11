// Domain types — what a "dashboard" is, what charts it contains.
// Modeled after tabularpro's DashboardFull / ChartConfig shape but trimmed
// for the vanilla rewrite. Will grow as later phases add filters, style tab,
// row/group support.

export type ChartType =
  // Bar family
  | 'bar'
  | 'horizontalBar'
  | 'stackedBar'
  | 'stackedBarPercent'
  | 'stackedHorizontalBar'
  | 'lollipop'
  // Line family
  | 'line'
  | 'spline'
  | 'area'
  | 'areaSpline'
  | 'stackedArea'
  // Pie family
  | 'pie'
  | 'donut'
  | 'semicircle'
  | 'variablePie'
  // Scatter family
  | 'scatter'
  | 'bubble'
  // Hierarchy / matrix
  | 'treemap'
  | 'heatmap'
  | 'sunburst'
  // Flow / specialty
  | 'funnel'
  | 'pyramid'
  | 'sankey'
  | 'timeline'
  | 'wordcloud'
  | 'gauge'
  | 'waterfall'
  // Display
  | 'kpi'
  | 'table'

/** Aggregation mode applied to the chart's dimension. */
export type AggregationMode = 'count' | 'percentage' | 'mean' | 'sum'

/** Filter operator. Phase D supports `in` only; more come later. */
export type FilterOperator = 'in' | 'not_in' | 'eq' | 'neq'

/** A filter applied to a dataset. `fieldId` matches a chart's `dimension.questionCode`. */
export interface DashboardFilter {
  id: string
  fieldId: string
  fieldName: string
  operator: FilterOperator
  values: string[]
}

export interface ChartDimension {
  questionCode: string
  questionText: string
  questionId: number
}

export interface ChartDataPoint {
  label: string
  value: number
}

export interface ChartDataSeries {
  name: string
  data: ChartDataPoint[]
}

export interface ChartConfig {
  dimension?: ChartDimension
  aggregation?: AggregationMode
  /** Chart-level filters — only affect this chart, applied on top of the
   *  dashboard-level filters. */
  filters?: DashboardFilter[]
  colors?: { palette: string[] }
  labels?: {
    showValues?: boolean
    showLegend?: boolean
    legendPosition?: 'top' | 'bottom' | 'left' | 'right'
    valueFormat?: 'number' | 'percent' | 'decimal1' | 'decimal2'
  }
}

export interface DashboardChartRecord {
  dashboard_chart_id: number
  dashboard_chart_type: ChartType
  dashboard_chart_title?: string
  dashboard_chart_config?: ChartConfig
  dashboard_page_id: number
  /** Layout in 12-col grid units. x/y/w/h match react-grid-layout conventions. */
  dashboard_chart_x?: number
  dashboard_chart_y?: number
  dashboard_chart_w?: number
  dashboard_chart_h?: number
  /** Pre-computed series data. In production this comes from getChartData;
   *  for the mock dashboard we embed it directly. */
  series?: ChartDataSeries[]
  /** Single value for KPI charts. */
  kpi_value?: number
  kpi_label?: string
}

export interface DashboardPageRecord {
  dashboard_page_id: number
  dashboard_page_name: string
  charts?: DashboardChartRecord[]
}

export interface DashboardRecord {
  dashboard_id: number
  dashboard_name: string
  dashboard_description?: string
  dashboard_slug?: string
  survey_id?: number
  survey_name?: string
  workspace_id?: number
  dashboard_settings?: Record<string, unknown>
  dashboard_inserted?: string
  dashboard_updated?: string
}

export interface DashboardFull extends DashboardRecord {
  pages: DashboardPageRecord[]
  /** Dashboard-level (global) filters. Apply to every chart whose dimension
   *  matches the filter's `fieldId`. */
  filters?: DashboardFilter[]
}
