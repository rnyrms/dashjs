// Internal types for the dashjs core (not domain types — see ./domain.ts).

import type {
  DashboardRecord,
  DashboardFull,
  DashboardChartRecord,
  DashboardFilter,
  ChartDataSeries,
} from './domain'

/** A field the user can bind to a chart's dimension or filter — the data
 *  vocabulary for a dashboard. The mock list ships sample fields covering
 *  the standard FieldType union; in production a DashJsDataSource supplies
 *  the real catalogue. */
export type FieldType = 'text' | 'numeric' | 'single' | 'multi' | 'scale' | 'date' | 'geo'
export interface DataField {
  id: string
  name: string
  type: FieldType
}

/** Adapter the host provides so dashjs can fetch live field catalogues and
 *  chart data instead of relying on mock arrays + embedded series. Both
 *  methods may return synchronously or as a Promise. */
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

export type DashJsMode = 'list' | 'editor' | 'viewer' | 'public' | 'auth'

/** Subset of REST methods the dashboard reaches for. Replace with your own. */
export interface DashJsApi {
  listDashboards: () => Promise<DashboardRecord[]>
  createDashboard: (data: { dashboard_name: string; survey_id?: number }) => Promise<DashboardRecord>
  deleteDashboard: (id: number) => Promise<void>
  // builder/viewer endpoints come in later phases
}

export interface DashJsOptions {
  mode?: DashJsMode
  /** Pre-fetched dashboards to render in `list` mode without an API. */
  dashboards?: DashboardRecord[]
  /** Single dashboard to render in `viewer` mode. */
  dashboard?: DashboardFull
  /** API adapter — if omitted in list mode, dashjs renders `dashboards` as a static list. */
  api?: Partial<DashJsApi>
  /** Override theme (light is default). */
  theme?: 'light' | 'dark'
  /** i18n dictionary; missing keys fall back to the English literal. */
  dictionary?: Record<string, string>
  /** Called after the user creates a dashboard from the list page. */
  onCreate?: (dashboard: DashboardRecord) => void
  /** Called when the user clicks a dashboard row to open it. */
  onOpen?: (dashboard: DashboardRecord) => void
  /** Called after a dashboard is deleted. */
  onDelete?: (id: number) => void
  /** Called when the user explicitly saves in editor mode. Receives a deep clone. */
  onSave?: (dashboard: DashboardFull) => void | Promise<void>
  /** Optional data source. When provided, the editor uses it for the field
   *  catalogue + chart data instead of the built-in mocks; charts re-fetch
   *  whenever their dimension/aggregation/filters change. */
  dataSource?: DashJsDataSource
}

export interface DashJsInstance {
  setMode: (mode: DashJsMode) => void
  getMode: () => DashJsMode
  setDashboards: (rows: DashboardRecord[]) => void
  destroy: () => void
}
