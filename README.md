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
  })
</script>
```

## What it does today

- **Editor mode** (`mode: 'editor'`) — Looker-Studio-inspired UI:
  - Top: menu bar shell, toolbar, filter bar
  - Center: 12-column drag/resize canvas (gridstack.js) with multi-page tabs
    at the bottom
  - Right rail: Data + Properties panels, both independently toggleable
- **Chart types**: bar, line, pie, KPI, table — Highcharts for chart primitives,
  Jspreadsheet for the table type, plain HTML for KPI cards
- **Add a chart** picker (toolbar `Add a chart ▾`) drops a typed chart on the
  active page with sample data
- **Click chart → Properties panel populates**: edit title / type / dimension /
  aggregation / filters live, chart re-renders on every change
- **Filters**: dashboard-level (filter bar chips) + chart-level (Properties
  Setup tab). Both apply on top of each other; charts whose dimension matches
  the filter's field re-render with the filtered series
- **Multi-page**: bottom tabs to switch, `+` button to add, toolbar arrows for
  prev/next
- **Light/dark theming** via CSS custom properties (no MUI runtime overhead)

## What's not done yet

- Real data-source integration (currently mock fields + mock series)
- Save / Publish / Slug check (no persistence yet — edits are in-memory)
- Style tab in Properties (colors, labels, legend — currently Setup only)
- KPI / Aggregation re-computation when filters apply (mock can't re-aggregate)
- Drag fields from Data panel onto chart slots
- Page rename / delete via right-click
- More chart types (stacked bar, horizontal bar, area, gauge, donut, radar)

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
- [ ] Phase E — Style tab + explicit Save (`onSave(dashboard)` callback)
- [ ] Phase F — Real data-source integration (replace mock fields/series)
- [ ] Phase G — Drag fields from Data panel onto chart slots
- [ ] Phase H — More chart types + stacked variants
- [ ] Phase I — Framework adapters (`@dashjs/react`, `@dashjs/vue`)

## License

[MIT](LICENSE)
