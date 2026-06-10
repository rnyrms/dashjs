title: Data Sources
keywords: dashjs, data source, DashJsDataSource, Jspreadsheet integration, live data, field catalog, chart data, custom adapter, real-time data
description: Learn how to connect Dashjs to any data backend using the DashJsDataSource adapter interface. Includes a complete Jspreadsheet integration example and field type mapping reference.
canonical: https://dashjs.com/docs/data-sources

# Data Sources

By default Dashjs renders charts using built-in mock data. To power dashboards with real data, implement the `DashJsDataSource` interface and pass it via `options.dataSource`. Dashjs calls `listFields()` to populate the field catalogue shown in the editor, and `getChartData()` each time a chart's slot configuration or filter changes.

Both methods can be synchronous or async.


## Documentation

### DashJsDataSource interface

```typescript
interface DashJsDataSource {
  listFields: () => DataField[] | Promise<DataField[]>
  getChartData: (
    chart: DashboardChartRecord,
    filters: DashboardFilter[],
  ) => ChartDataSeries[] | Promise<ChartDataSeries[]>
}
```

### DataField

The vocabulary the editor uses for slot pickers and filter controls:

```typescript
interface DataField {
  id: string      // internal key — matches fieldId in slot and filter configs
  name: string    // label shown in the editor UI
  type: FieldType // governs which chart slots accept this field
}

type FieldType = 'text' | 'numeric' | 'single' | 'multi' | 'scale' | 'date' | 'geo'
```

| FieldType | Description |
|-----------|-------------|
| `text` | Free-text values — used as dimension labels |
| `numeric` | Numbers — used in metric slots (sum, mean, count) |
| `single` | Low-cardinality categorical — shown as a filter dropdown |
| `multi` | Multi-select categorical — used in breakdown slots |
| `scale` | Ordinal scale (e.g. Likert 1–5) |
| `date` | ISO 8601 date strings — compatible with timeline and date-range controls |
| `geo` | Geographic labels — reserved for map chart types |

### ChartDataSeries

The shape `getChartData()` must return:

```typescript
interface ChartDataSeries {
  name: string          // series label shown in the chart legend
  data: ChartDataPoint[]
}

interface ChartDataPoint {
  label: string   // x-axis / dimension value
  value: number   // y-axis / metric value
}
```

For multi-series charts (stacked bar, line with breakdown), return one `ChartDataSeries` object per series.

### Filters passed to getChartData

`getChartData` receives the **full filter union** — dashboard-level filters plus any chart-level filters — already merged. You do not need to fetch or merge them yourself.

```typescript
interface DashboardFilter {
  id: string
  fieldId: string       // matches a DataField.id
  fieldName: string     // display label
  operator: FilterOperator
  values: string[]      // string list for in/not_in/eq/neq; [start,end] for between
  controlId?: number    // set when emitted by an on-canvas control widget
}

type FilterOperator = 'in' | 'not_in' | 'eq' | 'neq' | 'between'
```


## Examples

### Minimal static data source

```javascript
import dashjs from 'dashjs'

const rows = [
  { category: 'A', revenue: 120 },
  { category: 'B', revenue: 340 },
  { category: 'C', revenue: 210 },
]

const dataSource = {
  listFields() {
    return [
      { id: 'category', name: 'Category', type: 'single' },
      { id: 'revenue',  name: 'Revenue',  type: 'numeric' },
    ]
  },
  getChartData(chart, filters) {
    const dim    = chart.dashboard_chart_config?.slots?.dimension?.fieldId
    const metric = chart.dashboard_chart_config?.slots?.metric?.fieldId
    if (!dim || !metric) return []

    const filtered = filters.length === 0
      ? rows
      : rows.filter(r =>
          filters.every(f =>
            f.fieldId !== dim || f.values.includes(String(r[f.fieldId]))
          )
        )

    return [{
      name: metric,
      data: filtered.map(r => ({ label: String(r[dim]), value: Number(r[metric]) || 0 })),
    }]
  },
}

dashjs(document.getElementById('app'), {
  mode: 'editor',
  dataSource,
})
```

### Jspreadsheet integration

Connect a live Jspreadsheet worksheet as the data source. Column metadata drives the field catalogue; `getJson()` fetches current cell values at render time.

```javascript
import dashjs from 'dashjs'
import jspreadsheet from 'jspreadsheet'

const worksheets = jspreadsheet(document.getElementById('spreadsheet'), {
  worksheets: [{
    data: [
      ['Product', 'Q1', 'Q2'],
      ['Widget', 120, 180],
      ['Gadget', 90,  220],
    ],
    columns: [
      { name: 'product', title: 'Product', type: 'text' },
      { name: 'q1',      title: 'Q1 Sales', type: 'numeric' },
      { name: 'q2',      title: 'Q2 Sales', type: 'numeric' },
    ],
  }],
})

const worksheet = worksheets[0]

const dataSource = {
  listFields() {
    return (worksheet.options.columns ?? []).map((col, i) => ({
      id:   col.name  ?? `col_${i}`,
      name: col.title ?? col.name ?? `Column ${i + 1}`,
      type: col.type === 'numeric'  ? 'numeric'
          : col.type === 'calendar' ? 'date'
          : 'text',
    }))
  },
  getChartData(chart, filters) {
    const rows = worksheet.getJson(true)
    const dim    = chart.dashboard_chart_config?.slots?.dimension?.fieldId
    const metric = chart.dashboard_chart_config?.slots?.metric?.fieldId
    if (!dim || !metric) return []

    const filtered = filters.length === 0
      ? rows
      : rows.filter(r =>
          filters.every(f =>
            f.fieldId !== dim || f.values.includes(String(r[f.fieldId]))
          )
        )

    return [{
      name: metric,
      data: filtered.map(r => ({ label: String(r[dim]), value: Number(r[metric]) || 0 })),
    }]
  },
}

dashjs(document.getElementById('dashboard'), {
  mode: 'editor',
  dataSource,
})
```

### Async REST API data source

```javascript
const dataSource = {
  async listFields() {
    const res = await fetch('/api/fields')
    return res.json() // expected: DataField[]
  },
  async getChartData(chart, filters) {
    const res = await fetch('/api/chart-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chart, filters }),
    })
    return res.json() // expected: ChartDataSeries[]
  },
}
```


## Race condition protection

When charts are async, the editor uses a token-guard map internally (`chartFetchTokens`) so that a slower first request cannot overwrite the result of a faster later request. You do not need to implement this — it is handled automatically when you return a `Promise` from `getChartData`.


## Built-in CSV data source

For quick prototyping without an external backend, the editor includes an **Import Data** button. Supported formats: CSV, Jspreadsheet JSON (both `getData()` and `getJson()` output shapes), and all formats supported by [TabularJS](/docs/import-data) (XLSX, XLS, ODS, TSV, DIF, DBF, SLK).

See [Import Data](/docs/import-data) for the full workflow.
