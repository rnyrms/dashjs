title: API Reference
keywords: dashjs, API reference, DashJsOptions, DashJsInstance, DashboardFull, DashboardRecord, ChartType, TypeScript types, complete reference
description: Complete API reference for Dashjs. All types, interfaces, options, and instance methods exported by the library.
canonical: https://dashjs.com/docs/api-reference

# API Reference

Complete reference for the Dashjs public API. All types listed here are exported from the main `dashjs` module.


## Factory function

```typescript
function dashjs(element: HTMLElement, options?: DashJsOptions): DashJsInstance
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `element` | `HTMLElement` | Container element. Dashjs adds `data-dashjs` to it for CSS scoping. |
| `options` | `DashJsOptions` | Optional configuration object |

Returns a `DashJsInstance`.


## DashJsOptions

```typescript
interface DashJsOptions {
  mode?:        DashJsMode
  dashboards?:  DashboardRecord[]
  dashboard?:   DashboardFull
  api?:         Partial<DashJsApi>
  theme?:       'light' | 'dark'
  dictionary?:  Record<string, string>
  onCreate?:    (dashboard: DashboardRecord) => void
  onOpen?:      (dashboard: DashboardRecord) => void
  onDelete?:    (id: number) => void
  onSave?:      (dashboard: DashboardFull) => void | Promise<void>
  dataSource?:  DashJsDataSource
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `mode` | `DashJsMode` | `'list'` | Initial render mode |
| `dashboards` | `DashboardRecord[]` | `[]` | Pre-loaded dashboards for `list` mode |
| `dashboard` | `DashboardFull` | built-in stub | Dashboard to open in `editor` or `viewer` mode |
| `api` | `Partial<DashJsApi>` | — | REST adapter for the list page |
| `theme` | `'light' \| 'dark'` | `'light'` | Color theme |
| `dictionary` | `Record<string, string>` | — | i18n overrides; missing keys fall back to English |
| `onCreate` | function | — | Called after a dashboard is created |
| `onOpen` | function | — | Called when the user opens a dashboard |
| `onDelete` | function | — | Called after a dashboard is deleted |
| `onSave` | function | — | Called when the user saves in editor mode |
| `dataSource` | `DashJsDataSource` | built-in mocks | Live data adapter for fields and chart series |


## DashJsInstance

The object returned by the factory function:

```typescript
interface DashJsInstance {
  setMode:       (mode: DashJsMode) => void
  getMode:       () => DashJsMode
  setDashboards: (rows: DashboardRecord[]) => void
  destroy:       () => void
}
```

| Method | Description |
|--------|-------------|
| `setMode(mode)` | Switch the rendered page without reinitializing the container |
| `getMode()` | Return the current mode string |
| `setDashboards(rows)` | Replace the dashboard list in `list` mode without a full remount |
| `destroy()` | Remove all DOM, event listeners, Highcharts instances, and GridStack |


## DashJsMode

```typescript
type DashJsMode = 'list' | 'editor' | 'viewer' | 'public' | 'auth'
```


## DashJsDataSource

```typescript
interface DashJsDataSource {
  listFields:   () => DataField[] | Promise<DataField[]>
  getChartData: (
    chart: DashboardChartRecord,
    filters: DashboardFilter[],
  ) => ChartDataSeries[] | Promise<ChartDataSeries[]>
}
```

See [Data Sources](/docs/data-sources) for implementation details.


## DashJsApi

```typescript
interface DashJsApi {
  listDashboards:  () => Promise<DashboardRecord[]>
  createDashboard: (data: { dashboard_name: string; survey_id?: number }) => Promise<DashboardRecord>
  deleteDashboard: (id: number) => Promise<void>
}
```


## DataField

```typescript
interface DataField {
  id:   string
  name: string
  type: FieldType
}

type FieldType = 'text' | 'numeric' | 'single' | 'multi' | 'scale' | 'date' | 'geo'
```


## ChartDataSeries / ChartDataPoint

```typescript
interface ChartDataSeries {
  name: string
  data: ChartDataPoint[]
}

interface ChartDataPoint {
  label: string
  value: number
}
```


## DashboardRecord

```typescript
interface DashboardRecord {
  dashboard_id:          number
  dashboard_name:        string
  dashboard_description?: string
  dashboard_slug?:       string
  survey_id?:            number
  survey_name?:          string
  workspace_id?:         number
  dashboard_settings?:   Record<string, unknown>
  dashboard_inserted?:   string
  dashboard_updated?:    string
}
```


## DashboardFull

```typescript
interface DashboardFull extends DashboardRecord {
  pages:    DashboardPageRecord[]
  filters?: DashboardFilter[]
}
```


## DashboardPageRecord

```typescript
interface DashboardPageRecord {
  dashboard_page_id:   number
  dashboard_page_name: string
  charts?:             DashboardChartRecord[]
  controls?:           DashboardControlRecord[]
}
```


## DashboardChartRecord

```typescript
interface DashboardChartRecord {
  dashboard_chart_id:     number
  dashboard_chart_type:   ChartType
  dashboard_chart_title?: string
  dashboard_chart_config?: ChartConfig
  dashboard_page_id:      number
  dashboard_chart_x?:     number
  dashboard_chart_y?:     number
  dashboard_chart_w?:     number
  dashboard_chart_h?:     number
  series?:                ChartDataSeries[]
  kpi_value?:             number
  kpi_label?:             string
}
```


## ChartConfig

```typescript
interface ChartConfig {
  dimension?:   ChartDimension     // @deprecated — use slots.dimension
  aggregation?: AggregationMode    // @deprecated — use slots.metric.aggregation
  slots?:       Record<string, ChartSlotValue>
  filters?:     DashboardFilter[]
  colors?:      { palette: string[] }
  labels?: {
    showValues?:     boolean
    showLegend?:     boolean
    legendPosition?: 'top' | 'bottom' | 'left' | 'right'
    valueFormat?:    'number' | 'percent' | 'decimal1' | 'decimal2'
  }
}

interface ChartSlotValue {
  fieldId?:     string
  aggregation?: AggregationMode
}

type AggregationMode = 'count' | 'percentage' | 'mean' | 'sum'
```


## DashboardFilter

```typescript
interface DashboardFilter {
  id:         string
  fieldId:    string
  fieldName:  string
  operator:   FilterOperator
  values:     string[]
  controlId?: number
}

type FilterOperator = 'in' | 'not_in' | 'eq' | 'neq' | 'between'
```


## DashboardControlRecord

```typescript
interface DashboardControlRecord {
  dashboard_control_id:     number
  dashboard_page_id:        number
  dashboard_control_type:   ControlType
  dashboard_control_title?: string
  dashboard_control_x?:     number
  dashboard_control_y?:     number
  dashboard_control_w?:     number
  dashboard_control_h?:     number
  dashboard_control_config?: {
    field?:          { id: string; name: string }
    selectedValues?: string[]
  }
}

type ControlType = 'dropdown' | 'multiselect' | 'daterange' | 'search'
```


## ChartType

```typescript
type ChartType =
  | 'bar' | 'horizontalBar' | 'stackedBar' | 'stackedBarPercent'
  | 'stackedHorizontalBar' | 'lollipop'
  | 'line' | 'spline' | 'area' | 'areaSpline' | 'stackedArea'
  | 'pie' | 'donut' | 'semicircle' | 'variablePie'
  | 'scatter' | 'bubble'
  | 'treemap' | 'heatmap' | 'sunburst'
  | 'funnel' | 'pyramid' | 'sankey' | 'timeline' | 'wordcloud'
  | 'gauge' | 'waterfall'
  | 'kpi' | 'table'
```


## Static methods

```typescript
dashjs.version               // string — current library version
dashjs.setLicense(key: string) => void  // forward license key to Jspreadsheet
```
