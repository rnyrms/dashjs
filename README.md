# dashjs

Framework-agnostic dashboard component for surveys and analytics. Built on the
[Jspreadsheet](https://jspreadsheet.com/) stack — LemonadeJS, jSuites,
Jspreadsheet — with [Highcharts](https://www.highcharts.com/) for chart
rendering and [Lucide](https://lucide.dev/) for icons. Inspired by Looker
Studio's UX.

> **Status: early.** Vanilla TS rewrite in progress. Editor mode (drag/resize
> grid, multi-page, chart picker, properties panel, filters) works against
> mock data. Real data-source integration, save/publish, and Style tab are
> still ahead.

## Why dashjs

You can drop dashjs into a React, Vue, Svelte, or vanilla-HTML app the same
way — it has no host-framework dependency. Mount it on a `<div>`:

```html
<div id="app"></div>
<script type="module">
  import dashjs from 'dashjs'
  import 'dashjs/styles'

  const instance = dashjs(document.getElementById('app'), {
    mode: 'editor',
    dashboard: {
      dashboard_id: 1,
      dashboard_name: 'Q1 results',
      pages: [{ dashboard_page_id: 1, dashboard_page_name: 'Overview', charts: [] }],
    },
    onSave: async (dashboard) => {
      // Persist however you like — REST, GraphQL, IndexedDB, etc.
      await fetch('/api/dashboards/1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(dashboard),
      })
    },
  })
</script>
```

## What it does today

- **Editor mode** (`mode: 'editor'`) — Looker-Studio-inspired UI:
  - Top: menu bar shell, toolbar, filter bar
  - Center: 12-column drag/resize canvas (gridstack.js) with multi-page tabs
    at the bottom
  - Right rail: Data + Properties panels, both independently toggleable
- **Chart types** (29): bar, horizontal bar, stacked bar, 100% stacked bar,
  stacked horizontal bar, lollipop, line, spline, area, area spline,
  stacked area, pie, donut, semicircle, variable pie, scatter, bubble,
  treemap, heatmap, sunburst, funnel, pyramid, sankey, timeline,
  wordcloud, gauge, waterfall, KPI, table — Highcharts (+ funnel,
  treemap, heatmap, sunburst, sankey, timeline, wordcloud, variable-pie,
  lollipop, solid-gauge modules) for chart primitives, Jspreadsheet for
  the table type, plain HTML for KPI cards
- **Add a chart** picker (toolbar `Add a chart ▾`) drops a typed chart on the
  active page with sample data
- **Click chart → Properties panel populates**: edit title / type / dimension /
  aggregation / filters live, chart re-renders on every change
- **Filters**: dashboard-level (filter bar chips) + chart-level (Properties
  Setup tab). Both apply on top of each other; charts whose dimension matches
  the filter's field re-render with the filtered series
- **Multi-page**: bottom tabs to switch, `+` button to add, toolbar arrows for
  prev/next
- **Style tab**: per-chart palette swatches (bar/pie/line), data-label
  toggles, legend toggle + position, value-format selector
- **Save**: toolbar Save button enables on dirty edits; the host wires up
  persistence via the `onSave(dashboard)` option (async-aware, shows
  Saving… → Saved feedback)
- **Live data source**: optional `dataSource: { listFields, getChartData }`
  adapter — when provided, the editor fetches the field catalogue + per-chart
  data via the host's callbacks instead of using mocks. Per-chart loading
  placeholder; stale-response token guard so quick config changes don't
  race
- **Drag fields onto charts**: drag any field from the Data panel and drop
  it on a chart to set that chart's dimension
- **Light/dark theming** via CSS custom properties (no MUI runtime overhead)

## What's not done yet

- Publish / Slug check (host receives the dashboard via `onSave`; dashjs
  itself doesn't persist)
- KPI / Aggregation re-computation when filters apply (mock can't re-aggregate)
- Page rename / delete via right-click
- Gauge and radar chart types (need Highcharts-more module)

See the roadmap below for the planned phases.

## Architecture

```
src/
├── index.ts                       # public API: dashjs(element, options)
├── core/
│   ├── Dashboard.ts               # mode dispatcher (list / editor / viewer)
│   ├── pages/
│   │   ├── DashboardEditor.ts     # the editor UI + state
│   │   ├── DashboardViewer.ts     # read-only viewer
│   │   └── DashboardList.ts       # dashboard listing (placeholder)
│   ├── charts/
│   │   ├── renderChart.ts         # factory dispatching by type
│   │   ├── defaults.ts            # default chart factory for "Add a chart"
│   │   ├── applyFilters.ts        # mock-data filter helper
│   │   └── palette.ts             # default color palette
│   ├── widgets/                   # small jSuites wrappers (modal, etc.)
│   ├── icons.ts                   # Lucide icon helper
│   ├── domain.ts                  # domain types
│   ├── types.ts                   # public option / instance types
│   └── mockData.ts                # mock fields + demo dashboard
└── styles/
    └── dashjs.css                 # all CSS, scoped under [data-dashjs]
```

The factory function returns an imperative instance:

```ts
interface DashJsInstance {
  setMode: (mode: 'list' | 'editor' | 'viewer') => void
  getMode: () => DashJsMode
  setDashboards: (rows: DashboardRecord[]) => void
  destroy: () => void
}
```

Edits inside the editor mutate a deep-cloned copy of the input dashboard; the
public `onSave` callback (Phase E) will emit the updated dashboard JSON.

## Local development

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5180
```

The demo entry is `index.html` + `demo/main.ts` — both vanilla, no React.

```bash
npm run typecheck    # tsc --noEmit
```

## Stack

| Layer | Library | Why |
|-------|---------|-----|
| Reactivity | LemonadeJS | Tiny, framework-agnostic, same family as Jspreadsheet |
| UI primitives | jSuites | Calendar, color picker, dropdown, modal — vanilla-friendly |
| Data grid | Jspreadsheet | The Table chart type is a real Jspreadsheet worksheet |
| Charts | Highcharts | Vanilla `Highcharts.chart(el, opts)` — no React wrapper |
| Drag/resize layout | gridstack.js | Vanilla equivalent of react-grid-layout |
| Icons | lucide | Vanilla SVG strings, no React |

`react`, `react-dom`, `@mui/*`, and `react-i18next` are **not** dependencies.

## Roadmap

- [x] Phase A — Chart selection + Properties panel populated + live edit
- [x] Phase B — Add-a-chart picker (toolbar)
- [x] Phase C — Multi-page + drag/resize via gridstack.js
- [x] Phase D — Filters (dashboard-level + chart-level)
- [x] Phase E — Style tab + explicit Save (`onSave(dashboard)` callback)
- [x] Phase G — Drag fields from Data panel onto chart slots
- [x] Phase H — More chart types + stacked variants
- [x] Phase F — Real data-source integration (`dataSource` adapter)
- [ ] Phase I — Framework adapters (`@dashjs/react`, `@dashjs/vue`)

## License

[MIT](LICENSE)
