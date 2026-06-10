title: Chart Types
keywords: dashjs, chart types, bar chart, line chart, pie chart, scatter, bubble, treemap, heatmap, KPI, table, Highcharts, data visualization
description: Complete reference for all 29 chart types supported by Dashjs. Includes slot schemas, required fields, and configuration examples for every chart family.
canonical: https://dashjs.com/docs/chart-types

# Chart Types

Dashjs ships 29 chart types powered by Highcharts. Every type is configured through a **slot schema** — a declarative list of the field bindings the chart accepts (dimension, metric, breakdown, etc.). The editor renders the Setup tab dynamically from this schema.


## Chart type list

| Type | Family | Required slots |
|------|--------|---------------|
| `bar` | Bar | dimension, metric |
| `horizontalBar` | Bar | dimension, metric |
| `stackedBar` | Bar | dimension, metric |
| `stackedBarPercent` | Bar | dimension, metric |
| `stackedHorizontalBar` | Bar | dimension, metric |
| `lollipop` | Bar | dimension, metric |
| `line` | Line | dimension, metric |
| `spline` | Line | dimension, metric |
| `area` | Line | dimension, metric |
| `areaSpline` | Line | dimension, metric |
| `stackedArea` | Line | dimension, breakdown, metric |
| `pie` | Pie | dimension, metric |
| `donut` | Pie | dimension, metric |
| `semicircle` | Pie | dimension, metric |
| `variablePie` | Pie | dimension, metric, sizeMetric |
| `scatter` | Scatter | xMetric, yMetric |
| `bubble` | Scatter | xMetric, yMetric, sizeMetric |
| `treemap` | Hierarchy | dimension, metric |
| `heatmap` | Matrix | xDimension, yDimension, metric |
| `sunburst` | Hierarchy | dimension (outer ring), metric |
| `funnel` | Flow | dimension (stage), metric |
| `pyramid` | Flow | dimension (stage), metric |
| `sankey` | Flow | source (from), target (to), metric |
| `timeline` | Specialty | dimension (event — date field) |
| `wordcloud` | Specialty | dimension (term), metric (weight) |
| `gauge` | Scalar | metric |
| `waterfall` | Specialty | dimension (step), metric (change) |
| `kpi` | Display | metric |
| `table` | Display | dimension, metric |


## Slot schema reference

Slots are the named field bindings each chart type exposes. The editor renders one picker per slot in the Setup tab.

| SlotKind | Description |
|----------|-------------|
| `dimension` | A categorical or date field whose values become x-axis labels / segment names |
| `metric` | A numeric aggregation — `count`, `percentage`, `sum`, or `mean` |

### Aggregation modes

| Mode | Description | Requires a field? |
|------|-------------|-------------------|
| `count` | Count of rows | No |
| `percentage` | Percentage of total rows | No |
| `sum` | Sum of a numeric field's values | Yes |
| `mean` | Average of a numeric field's values | Yes |

### Detailed slot schemas by type

#### Bar family

All bar types share a `dimension + metric` base. Stacked variants add an optional `breakdown` slot whose values become the series labels.

```
bar / horizontalBar / lollipop
  - dimension (required)
  - metric    (required)

stackedBar / stackedBarPercent / stackedHorizontalBar
  - dimension  (required)
  - breakdown  (optional)
  - metric     (required)
```

#### Line / area family

Same as stacked bar — `breakdown` produces multi-series lines.

```
line / spline / area / areaSpline
  - dimension  (required)
  - breakdown  (optional)
  - metric     (required)

stackedArea
  - dimension  (required)
  - breakdown  (required)
  - metric     (required)
```

#### Pie family

```
pie / donut / semicircle
  - dimension  (required)
  - metric     (required)

variablePie
  - dimension   (required) — segment name
  - metric      (required) — controls the slice angle
  - sizeMetric  (required) — controls the slice radius
```

#### Scatter / bubble

Both axes are numeric metrics. `breakdown` groups points into named series.

```
scatter
  - xMetric    (required)
  - yMetric    (required)
  - breakdown  (optional)

bubble
  - xMetric    (required)
  - yMetric    (required)
  - sizeMetric (required)
  - breakdown  (optional)
```

#### Hierarchy / matrix

```
treemap
  - dimension  (required)
  - metric     (required)

heatmap
  - xDimension (required)
  - yDimension (required)
  - metric     (required)

sunburst
  - dimension  (required) — outer ring
  - dimension2 (optional) — inner ring
  - metric     (required)
```

#### Flow / specialty

```
funnel / pyramid
  - dimension  (required) — stage label
  - metric     (required)

sankey
  - source     (required) — from node
  - target     (required) — to node
  - metric     (required) — flow value

timeline
  - dimension  (required, date field) — event label

wordcloud
  - dimension  (required) — term text
  - metric     (required) — term weight

gauge
  - metric     (required)

waterfall
  - dimension  (required) — step label
  - metric     (required) — change value
```

#### Display types

```
kpi
  - metric     (required)

table
  - dimension  (required)
  - metric     (required)
```


## Chart configuration

Chart appearance is controlled via `ChartConfig` stored inside each chart record.

```typescript
interface ChartConfig {
  slots?:  Record<string, ChartSlotValue>
  filters?: DashboardFilter[]
  colors?: { palette: string[] }
  labels?: {
    showValues?:     boolean
    showLegend?:     boolean
    legendPosition?: 'top' | 'bottom' | 'left' | 'right'
    valueFormat?:    'number' | 'percent' | 'decimal1' | 'decimal2'
  }
}
```

### Color palettes

Every chart uses the default palette unless `colors.palette` overrides it:

```javascript
// Default palette
['#2383E2', '#6940A5', '#D44C47', '#CB7B37', '#448361', '#337EA9', '#9065B0', '#C14C8A']
```

Pass a custom palette per chart:

```javascript
dashboard.pages[0].charts[0].dashboard_chart_config = {
  ...existingConfig,
  colors: {
    palette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'],
  },
}
```


## Adding a new chart type

To extend Dashjs with a custom chart type:

1. Add the new identifier to the `ChartType` union in `src/core/domain.ts`
2. Add its slot schema to `CHART_TYPE_SCHEMAS` in `src/core/charts/slots.ts`
3. Implement the renderer in `src/core/charts/renderChart.ts` — receive `(container, chart, options)`, return `{ destroy() }`
4. Add an icon and display label in the type picker inside `DashboardEditor.ts`
5. Add default data for the new type in `src/core/charts/defaults.ts`
