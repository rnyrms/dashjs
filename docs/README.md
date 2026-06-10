title: Dashjs Documentation
keywords: dashjs, documentation, dashboard builder, BI dashboard, JavaScript, TypeScript, Highcharts
description: Official documentation for Dashjs — a framework-agnostic TypeScript library for building interactive BI dashboards.
canonical: https://dashjs.com/docs

# Dashjs Documentation

Dashjs is a framework-agnostic TypeScript library for building interactive BI dashboards. It provides a complete editor, viewer, and list page — powered by Highcharts charts on a GridStack drag-and-drop canvas, reading data from any backend via a clean adapter interface.

## Documentation index

| Page | Description |
|------|-------------|
| [Getting Started](./getting-started.md) | Installation, first dashboard, mode overview |
| [Dashboard Structure](./dashboard-structure.md) | Pages, charts, layout, serialization |
| [Data Sources](./data-sources.md) | `DashJsDataSource` interface, Jspreadsheet integration, async REST adapters |
| [Chart Types](./chart-types.md) | All 29 types, slot schemas, configuration |
| [Filters](./filters.md) | Filter operators, dashboard vs chart filters, interactive controls |
| [Import Data](./import-data.md) | CSV, Jspreadsheet JSON, TabularJS (XLSX, ODS, and more) |
| [Theming](./theming.md) | CSS custom properties, dark mode, style scoping |
| [Events](./events.md) | `onCreate`, `onOpen`, `onDelete`, `onSave` callbacks |
| [API Reference](./api-reference.md) | Complete type and interface reference |

## Quick example

```javascript
import dashjs from 'dashjs'
import 'dashjs/styles'

// Render the dashboard list
const instance = dashjs(document.getElementById('app'), {
  mode: 'list',
  dashboards: await fetch('/api/dashboards').then(r => r.json()),
  onOpen: async (row) => {
    const full = await fetch(`/api/dashboards/${row.dashboard_id}`).then(r => r.json())
    instance.setMode('editor')
  },
  onSave: async (dashboard) => {
    await fetch(`/api/dashboards/${dashboard.dashboard_id}`, {
      method: 'PUT',
      body: JSON.stringify(dashboard),
    })
  },
})
```

## Stack

| Library | Version | Role |
|---------|---------|------|
| TypeScript | 5.9 | Language |
| Highcharts | 12.x | Chart rendering |
| GridStack | 12.x | Drag-and-drop canvas |
| Jspreadsheet | 12.x | Dashboard list table and data integration |
| jSuites | 6.x | UI components |
| LemonadeJS | 5.x | Lightweight reactivity |
| TabularJS | 1.x | Spreadsheet file import (XLSX, ODS, …) |
