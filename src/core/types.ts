// Internal types for the dashjs core (not domain types — see ./domain.ts).

import type {
  DashboardFull,
  DashboardChartRecord,
  DashboardFilter,
  ChartDataSeries,
} from './domain'

/** A field the user can bind to a chart's dimension or filter — the data
 *  vocabulary for a dashboard. Supplied by the host via DashJsDataSource
 *  or by importing a data file in the editor. */
export type FieldType = 'text' | 'numeric' | 'single' | 'multi' | 'scale' | 'date' | 'geo'
export interface DataField {
  id: string
  name: string
  type: FieldType
}

/** Adapter the host provides so dashjs can fetch live field catalogues and
 *  chart data. Both methods may return synchronously or as a Promise. */
export interface DashJsDataSource {
  /** Field catalogue available for binding to dimensions and filters. */
  listFields: () => DataField[] | Promise<DataField[]>
  /** Resolve a chart's series, applying both global + chart-level filters.
   *  `filters` is the full union (dashboard.filters + chart.dashboard_chart_config.filters);
   *  the host decides how to translate them into its query. */
  getChartData: (
    chart: DashboardChartRecord,
    filters: DashboardFilter[],
  ) => ChartDataSeries[] | Promise<ChartDataSeries[]>
}

export interface DashJsOptions {
  /** Dashboard to load into the editor. Omitted = a new empty dashboard. */
  dashboard?: DashboardFull
  /** Override theme (light is default). */
  theme?: 'light' | 'dark'
  /** i18n dictionary; missing keys fall back to the English literal. */
  dictionary?: Record<string, string>
  /** Called when the user explicitly saves. Receives a deep clone. */
  onSave?: (dashboard: DashboardFull) => void | Promise<void>
  /** Optional data source. When provided, the editor uses it for the field
   *  catalogue + chart data; charts re-fetch whenever their
   *  dimension/aggregation/filters change. */
  dataSource?: DashJsDataSource
}

export interface DashJsInstance {
  destroy: () => void
}
