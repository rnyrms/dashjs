import dashjs from '../src/index'
import type { DashJsDataSource } from '../src/index'
import { MOCK_DASHBOARD, MOCK_FIELDS } from '../src/core/mockData'

const root = document.getElementById('app')!

// Demo data source: pretends to fetch fields + chart data from an API by
// returning the mocks behind a 250ms delay. Real hosts replace this with
// REST/GraphQL/BigQuery calls.
const demoDataSource: DashJsDataSource = {
  listFields: async () => {
    await new Promise((r) => setTimeout(r, 250))
    return MOCK_FIELDS
  },
  getChartData: async (chart, filters) => {
    await new Promise((r) => setTimeout(r, 250))
    // Echo whatever the chart already embeds, after applying filters
    // client-side. A real adapter would translate `filters` + the chart's
    // dimension/aggregation into a server-side query.
    const existing = chart.series ?? []
    if (filters.length === 0) return existing
    return existing.map((s) => ({
      ...s,
      data: s.data.filter((d) => {
        const matchesFilter = filters.every((f) => {
          if (f.fieldId !== chart.dashboard_chart_config?.dimension?.questionCode) return true
          const inSet = f.values.includes(d.label)
          return f.operator === 'in' || f.operator === 'eq' ? inSet : !inSet
        })
        return matchesFilter
      }),
    }))
  },
}

const instance = dashjs(root, {
  mode: 'editor',
  dashboard: MOCK_DASHBOARD,
  dataSource: demoDataSource,
  onSave: async (dashboard) => {
    // Simulate a network round-trip so we can see the "Saving…" state.
    await new Promise((resolve) => setTimeout(resolve, 400))
    console.log('[demo] onSave', dashboard)
    ;(window as any).lastSavedDashboard = dashboard
  },
})

// Light/dark toggle in the demo header.
const themeBtn = document.getElementById('theme-toggle')!
let theme: 'light' | 'dark' = 'light'
themeBtn.addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light'
  root.setAttribute('data-dashjs-theme', theme)
})

// Mode toggle for editor ↔ viewer comparison.
const modeBtn = document.getElementById('mode-toggle')
let mode: 'editor' | 'viewer' = 'editor'
modeBtn?.addEventListener('click', () => {
  mode = mode === 'editor' ? 'viewer' : 'editor'
  instance.setMode(mode)
  modeBtn.textContent = mode === 'editor' ? 'Switch to view mode' : 'Switch to edit mode'
})

;(window as any).dashjs = { instance, dashjs }
