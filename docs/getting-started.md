title: Getting Started with Dashjs
keywords: dashjs, dashboard builder, data visualization, JavaScript dashboard, TypeScript dashboard, BI dashboard, chart builder, framework-agnostic, installation, getting started
description: Step-by-step guide to install Dashjs and create your first interactive dashboard. Learn how to embed the editor, viewer, and list pages in any JavaScript application.
canonical: https://dashjs.com/docs/getting-started

# Getting Started

Dashjs is a framework-agnostic TypeScript library for building interactive BI dashboards with the look and feel of tools like Looker Studio. It renders Highcharts charts on a drag-and-drop GridStack canvas, reads data from any source via the `DashJsDataSource` adapter, and ships a complete editor, viewer, and list page — all in a single zero-dependency library.


## Installation

### NPM

```bash
npm install dashjs
```

### Peer dependencies

Dashjs delegates rendering to several proven libraries. Install them alongside:

```bash
npm install highcharts gridstack jspreadsheet jsuites lemonadejs lucide
```

### Styles

Import the Dashjs stylesheet once, at the application entry point:

```javascript
import 'dashjs/styles'
```


## Documentation

### Factory function

```javascript
import dashjs from 'dashjs'

const instance = dashjs(element, options)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `element` | `HTMLElement` | Container where Dashjs will render |
| `options` | `DashJsOptions` | Configuration — see [API Reference](/docs/api-reference) |

Returns a `DashJsInstance` with imperative controls.

### Static helpers

| Helper | Description |
|--------|-------------|
| `dashjs.version` | Current library version string |
| `dashjs.setLicense(key)` | Forward a Jspreadsheet license key to the embedded Jspreadsheet instance |


## Modes

Dashjs renders in one of four modes, set via `options.mode`:

| Mode | Description |
|------|-------------|
| `list` | Dashboard list with create/open/delete actions |
| `editor` | Full drag-and-drop canvas with chart builder and data import |
| `viewer` | Read-only canvas for embedding dashboards in end-user pages |
| `public` | *(planned)* Shareable public view |
| `auth` | *(planned)* Auth gate before accessing a dashboard |


## Examples

### Embed the dashboard list

```html
<html>
<head>
  <link rel="stylesheet" href="node_modules/dashjs/src/styles/dashjs.css" />
</head>
<body>
  <div id="app"></div>

  <script type="module">
    import dashjs from 'dashjs'

    const instance = dashjs(document.getElementById('app'), {
      mode: 'list',
      dashboards: [
        { dashboard_id: 1, dashboard_name: 'Sales Q1', dashboard_updated: '2026-04-01' },
        { dashboard_id: 2, dashboard_name: 'Marketing', dashboard_updated: '2026-03-15' },
      ],
      onOpen: (dashboard) => {
        console.log('Opening dashboard', dashboard.dashboard_id)
        instance.setMode('editor')
      },
    })
  </script>
</body>
</html>
```

### Open the editor directly

```javascript
import dashjs from 'dashjs'
import 'dashjs/styles'

const instance = dashjs(document.getElementById('app'), {
  mode: 'editor',
  dashboard: {
    dashboard_id: 1,
    dashboard_name: 'My Dashboard',
    pages: [],
  },
  onSave: async (dashboard) => {
    await fetch('/api/dashboards/1', {
      method: 'PUT',
      body: JSON.stringify(dashboard),
    })
  },
})
```

### Embed a read-only viewer

```javascript
import dashjs from 'dashjs'
import 'dashjs/styles'

const dashboard = await fetch('/api/dashboards/1').then(r => r.json())

dashjs(document.getElementById('app'), {
  mode: 'viewer',
  dashboard,
})
```

### Switch modes at runtime

```javascript
const instance = dashjs(document.getElementById('app'), { mode: 'list' })

// When the user clicks a dashboard row, switch to the editor.
// Pass onOpen to capture the dashboard first.
dashjs(element, {
  mode: 'list',
  onOpen: (row) => {
    instance.setMode('editor')
  },
})
```

### Destroy the instance

```javascript
const instance = dashjs(document.getElementById('app'), { mode: 'list' })

// Later — clean up event listeners, Highcharts instances, and GridStack.
instance.destroy()
```


## Dark theme

Pass `theme: 'dark'` to activate the built-in dark palette:

```javascript
dashjs(element, {
  mode: 'editor',
  theme: 'dark',
})
```

See [Theming](/docs/theming) for CSS custom properties and full override instructions.
