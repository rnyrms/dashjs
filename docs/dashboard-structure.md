title: Dashboard Structure
keywords: dashjs, dashboard structure, pages, charts, layout, grid, DashboardFull, DashboardPageRecord, DashboardChartRecord, GridStack
description: Understand how a Dashjs dashboard is structured in memory. Learn about pages, chart records, grid layout, and how to build or modify a DashboardFull object programmatically.
canonical: https://dashjs.com/docs/dashboard-structure

# Dashboard Structure

A Dashjs dashboard is represented as a `DashboardFull` object — a plain serializable JavaScript object you can store as JSON and restore later. Understanding its shape lets you build dashboards programmatically, persist them to a database, and reload them without loss.


## Overview

```
DashboardFull
└── pages: DashboardPageRecord[]
    ├── charts: DashboardChartRecord[]
    │   └── dashboard_chart_config: ChartConfig
    │       └── slots, filters, colors, labels
    └── controls: DashboardControlRecord[]

DashboardFull.filters   ← dashboard-level filters (apply to all charts)
```

### Hierarchy

| Level | Type | Description |
|-------|------|-------------|
| Dashboard | `DashboardFull` | Top-level container — name, description, global filters |
| Page | `DashboardPageRecord` | A tab within the dashboard — has its own canvas |
| Chart | `DashboardChartRecord` | A single chart or KPI on the canvas |
| Control | `DashboardControlRecord` | An interactive filter widget on the canvas |


## Pages

A dashboard can have multiple pages (tabs). Each page is independent — charts, controls, and their layouts are stored per page.

```typescript
const dashboard: DashboardFull = {
  dashboard_id: 1,
  dashboard_name: 'Sales Dashboard',
  pages: [
    {
      dashboard_page_id: 1,
      dashboard_page_name: 'Overview',
      charts: [],
      controls: [],
    },
    {
      dashboard_page_id: 2,
      dashboard_page_name: 'Details',
      charts: [],
      controls: [],
    },
  ],
}
```


## Charts

Each chart record stores its type, layout position, field bindings (slots), and optional pre-computed series data.

```typescript
const chart: DashboardChartRecord = {
  dashboard_chart_id: 1,
  dashboard_chart_type: 'bar',
  dashboard_chart_title: 'Revenue by Region',
  dashboard_page_id: 1,
  // Grid layout — 12-column units
  dashboard_chart_x: 0,
  dashboard_chart_y: 0,
  dashboard_chart_w: 6,
  dashboard_chart_h: 4,
  // Field bindings
  dashboard_chart_config: {
    slots: {
      dimension: { fieldId: 'region' },
      metric:    { aggregation: 'sum', fieldId: 'revenue' },
    },
  },
}
```

### Grid layout

Dashjs uses a 12-column GridStack grid. Chart positions and sizes are stored as grid units:

| Property | Description |
|----------|-------------|
| `dashboard_chart_x` | Left position in columns (0–11) |
| `dashboard_chart_y` | Top position in rows |
| `dashboard_chart_w` | Width in columns (1–12) |
| `dashboard_chart_h` | Height in rows |

Charts drag and snap to the grid. Layout changes are persisted back into the chart record and included in the next `onSave` payload.

### Slot bindings

Charts bind to data fields via **slots**. Slot IDs depend on the chart type (see [Chart Types](/docs/chart-types)).

```typescript
dashboard_chart_config: {
  slots: {
    dimension: { fieldId: 'product' },
    metric:    { aggregation: 'sum', fieldId: 'sales' },
    breakdown: { fieldId: 'region' },
  },
}
```

### KPI charts

KPI and gauge charts work as scalar displays. They use the `metric` slot but also accept pre-computed values for rendering without a live data source:

```typescript
{
  dashboard_chart_id: 10,
  dashboard_chart_type: 'kpi',
  dashboard_page_id: 1,
  kpi_value: 42381,
  kpi_label: 'Total Revenue',
  dashboard_chart_config: {
    slots: { metric: { aggregation: 'sum', fieldId: 'revenue' } },
  },
}
```

### Pre-computed series

In environments without a live `DashJsDataSource`, you can embed series data directly in the chart record:

```typescript
{
  dashboard_chart_id: 5,
  dashboard_chart_type: 'pie',
  dashboard_page_id: 1,
  series: [
    {
      name: 'Region Share',
      data: [
        { label: 'North', value: 42 },
        { label: 'South', value: 31 },
        { label: 'East',  value: 27 },
      ],
    },
  ],
}
```


## Full example

```javascript
const dashboard = {
  dashboard_id: 1,
  dashboard_name: 'Q1 Report',
  dashboard_description: 'Sales performance overview',
  pages: [
    {
      dashboard_page_id: 1,
      dashboard_page_name: 'Overview',
      charts: [
        {
          dashboard_chart_id: 1,
          dashboard_chart_type: 'bar',
          dashboard_chart_title: 'Revenue by Region',
          dashboard_page_id: 1,
          dashboard_chart_x: 0,
          dashboard_chart_y: 0,
          dashboard_chart_w: 8,
          dashboard_chart_h: 4,
          dashboard_chart_config: {
            slots: {
              dimension: { fieldId: 'region' },
              metric: { aggregation: 'sum', fieldId: 'revenue' },
            },
          },
        },
        {
          dashboard_chart_id: 2,
          dashboard_chart_type: 'kpi',
          dashboard_chart_title: 'Total Revenue',
          dashboard_page_id: 1,
          dashboard_chart_x: 8,
          dashboard_chart_y: 0,
          dashboard_chart_w: 4,
          dashboard_chart_h: 2,
          kpi_value: 156000,
          kpi_label: 'Revenue',
          dashboard_chart_config: {
            slots: { metric: { aggregation: 'sum', fieldId: 'revenue' } },
          },
        },
      ],
      controls: [
        {
          dashboard_control_id: 1,
          dashboard_page_id: 1,
          dashboard_control_type: 'dropdown',
          dashboard_control_title: 'Filter by Region',
          dashboard_control_x: 0,
          dashboard_control_y: 5,
          dashboard_control_w: 3,
          dashboard_control_h: 1,
          dashboard_control_config: {
            field: { id: 'region', name: 'Region' },
          },
        },
      ],
    },
  ],
  filters: [],
}

import dashjs from 'dashjs'
dashjs(document.getElementById('app'), { mode: 'viewer', dashboard })
```


## Serialization

`DashboardFull` is a plain JSON-serializable object. Store it directly in a database as a JSON column or in a REST API:

```javascript
// Save
const onSave = async (dashboard) => {
  await fetch('/api/dashboards/1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dashboard),
  })
}

// Load
const dashboard = await fetch('/api/dashboards/1').then(r => r.json())
dashjs(element, { mode: 'editor', dashboard, onSave })
```
