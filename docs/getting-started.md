title: Getting Started with Dashjs
keywords: dashjs, dashboard builder, data visualization, JavaScript dashboard, TypeScript dashboard, BI dashboard, chart builder, framework-agnostic, installation, getting started
description: Step-by-step guide to install Dashjs and create your first interactive dashboard. Learn how to embed the dashboard editor in any JavaScript application.
canonical: https://dashjs.com/docs/getting-started

# Getting Started

Dashjs is a framework-agnostic TypeScript library for building interactive BI dashboards with the look and feel of tools like Looker Studio. It renders Highcharts charts on a drag-and-drop GridStack canvas, reads data from any source via the `DashJsDataSource` adapter, and ships a complete dashboard editor — all in a single zero-dependency library.


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

Calling the factory mounts the dashboard editor into `element`. Pass `options.dashboard` to load a saved dashboard, or omit it to start with a new empty dashboard. Returns a `DashJsInstance` with imperative controls.

### Static helpers

| Helper | Description |
|--------|-------------|
| `dashjs.version` | Current library version string |
| `dashjs.setLicense(key)` | Forward a Jspreadsheet license key to the embedded Jspreadsheet instance |


## Examples

### Start a new empty dashboard

```html
<html>
<head>
  <link rel="stylesheet" href="node_modules/dashjs/src/styles/dashjs.css" />
</head>
<body>
  <div id="app"></div>

  <script type="module">
    import dashjs from 'dashjs'

    // Omitting options.dashboard opens the editor with a new empty dashboard.
    const instance = dashjs(document.getElementById('app'), {
      onSave: (dashboard) => {
        console.log('Saved dashboard', dashboard)
      },
    })
  </script>
</body>
</html>
```

### Open a saved dashboard

```javascript
import dashjs from 'dashjs'
import 'dashjs/styles'

const instance = dashjs(document.getElementById('app'), {
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

### Load a dashboard from your API

```javascript
import dashjs from 'dashjs'
import 'dashjs/styles'

const dashboard = await fetch('/api/dashboards/1').then(r => r.json())

dashjs(document.getElementById('app'), {
  dashboard,
})
```

### Destroy the instance

```javascript
const instance = dashjs(document.getElementById('app'))

// Later — clean up event listeners, Highcharts instances, and GridStack.
instance.destroy()
```


## Dark theme

Pass `theme: 'dark'` to activate the built-in dark palette:

```javascript
dashjs(element, {
  theme: 'dark',
})
```

See [Theming](/docs/theming) for CSS custom properties and full override instructions.
