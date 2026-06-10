title: Filters
keywords: dashjs, filters, dashboard filters, chart filters, filter operators, interactive controls, dropdown filter, date range, data filtering
description: Learn how dashboard-level and chart-level filters work in Dashjs, including all filter operators, on-canvas interactive controls, and how filters are applied to chart data.
canonical: https://dashjs.com/docs/filters

# Filters

Dashjs supports two levels of filtering: **dashboard-level filters** that apply to every chart whose dimension matches the filter's field, and **chart-level filters** that narrow only one specific chart. Both are stored in `DashboardFilter` objects and are passed together to `DashJsDataSource.getChartData()`.

On-canvas **control widgets** (dropdown, multiselect, date range) let the viewer interact with filters without opening the editor.


## Documentation

### DashboardFilter

```typescript
interface DashboardFilter {
  id: string
  fieldId: string      // matches a DataField.id
  fieldName: string    // display label in the filter panel
  operator: FilterOperator
  values: string[]     // strings for in/not_in/eq/neq; [start, end] for between
  controlId?: number   // present when emitted by an on-canvas control
}
```

### FilterOperator

| Operator | Description | `values` shape |
|----------|-------------|----------------|
| `in` | Point label must be in the list | `['A', 'B', 'C']` |
| `not_in` | Point label must NOT be in the list | `['X', 'Y']` |
| `eq` | Point label equals a single value | `['target']` |
| `neq` | Point label does not equal a single value | `['exclude']` |
| `between` | Point label is lexicographically between two bounds (inclusive). Either bound can be empty for an open range. Used for date ranges. | `['2024-01-01', '2024-06-30']` |

### How filters are applied

When `getChartData()` is called, Dashjs merges:

1. `DashboardFull.filters` — dashboard-level filters
2. `DashboardChartRecord.dashboard_chart_config.filters` — chart-level filters

The merged array is passed as the second argument to `getChartData()`. The host is responsible for applying them to its query. If you use the built-in mock data path (no custom `DashJsDataSource`), Dashjs applies them automatically by matching `filter.fieldId` against the chart's dimension field.

Only filters whose `fieldId` matches a chart's **dimension** affect that chart. Filters for fields not used as the dimension are silently ignored for that chart.

### On-canvas controls

Controls are interactive widgets placed on the dashboard canvas alongside charts. When the viewer changes a control's value, Dashjs updates the matching filter and re-renders all affected charts.

```typescript
interface DashboardControlRecord {
  dashboard_control_id: number
  dashboard_page_id: number
  dashboard_control_type: ControlType
  dashboard_control_title?: string
  dashboard_control_x?: number
  dashboard_control_y?: number
  dashboard_control_w?: number
  dashboard_control_h?: number
  dashboard_control_config?: {
    field?: { id: string; name: string }
    selectedValues?: string[]
  }
}

type ControlType = 'dropdown' | 'multiselect' | 'daterange' | 'search'
```

| ControlType | Emitted filter | Notes |
|-------------|----------------|-------|
| `dropdown` | `operator: 'in'`, single value | Fully implemented in v0.2 |
| `multiselect` | `operator: 'in'`, multiple values | Planned |
| `daterange` | `operator: 'between'`, `[start, end]` | Planned |
| `search` | `operator: 'eq'` | Planned |


## Examples

### Dashboard-level filter

```javascript
const dashboard = {
  dashboard_id: 1,
  dashboard_name: 'Sales',
  pages: [/* ... */],
  filters: [
    {
      id: 'f1',
      fieldId: 'region',
      fieldName: 'Region',
      operator: 'in',
      values: ['North', 'South'],
    },
  ],
}

dashjs(element, { mode: 'viewer', dashboard })
```

### Chart-level filter

```javascript
const chart = {
  dashboard_chart_id: 1,
  dashboard_chart_type: 'bar',
  dashboard_page_id: 1,
  dashboard_chart_config: {
    slots: {
      dimension: { fieldId: 'product' },
      metric:    { aggregation: 'sum', fieldId: 'revenue' },
    },
    filters: [
      {
        id: 'cf1',
        fieldId: 'product',
        fieldName: 'Product',
        operator: 'not_in',
        values: ['Widget Pro'],
      },
    ],
  },
}
```

### Date range filter

```javascript
{
  id: 'df1',
  fieldId: 'order_date',
  fieldName: 'Order Date',
  operator: 'between',
  values: ['2024-01-01', '2024-06-30'],
}
```

### Applying filters in a custom data source

When you implement `DashJsDataSource`, the full merged filter list arrives as the second argument:

```javascript
getChartData(chart, filters) {
  const dim    = chart.dashboard_chart_config?.slots?.dimension?.fieldId
  const metric = chart.dashboard_chart_config?.slots?.metric?.fieldId

  // Only filters relevant to this chart's dimension field matter.
  const relevant = filters.filter(f => f.fieldId === dim)

  const filtered = myRows.filter(row =>
    relevant.every(f => {
      switch (f.operator) {
        case 'in':      return f.values.includes(String(row[f.fieldId]))
        case 'not_in':  return !f.values.includes(String(row[f.fieldId]))
        case 'eq':      return String(row[f.fieldId]) === f.values[0]
        case 'neq':     return String(row[f.fieldId]) !== f.values[0]
        case 'between': {
          const v = String(row[f.fieldId])
          if (f.values[0] && v < f.values[0]) return false
          if (f.values[1] && v > f.values[1]) return false
          return true
        }
      }
    })
  )

  return [{
    name: metric ?? '',
    data: filtered.map(r => ({ label: String(r[dim ?? '']), value: Number(r[metric ?? '']) || 0 })),
  }]
}
```
