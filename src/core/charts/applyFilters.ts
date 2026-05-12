// Apply filters to a chart's series for rendering. Mock-data version.
//
// In a real backend-backed product the filters would be sent with the query
// and the server returns aggregated series. Here, with pre-computed mock
// series, we approximate by filtering the series' data points whose `label`
// matches the filter's value list — but only when the filter's fieldId
// matches the chart's dimension questionCode. This is enough to demo the UX.

import type { DashboardChartRecord, DashboardFilter } from '../domain'

export function applyFilters(
  chart: DashboardChartRecord,
  globalFilters: DashboardFilter[] = [],
): DashboardChartRecord {
  const chartFilters = chart.dashboard_chart_config?.filters ?? []
  const all = [...globalFilters, ...chartFilters]
  if (all.length === 0 || !chart.series) return chart

  const dimensionFieldId = chart.dashboard_chart_config?.dimension?.questionCode
  if (!dimensionFieldId) return chart

  // Only filters whose fieldId matches this chart's dimension affect it.
  const relevant = all.filter((f) => f.fieldId === dimensionFieldId && f.values.length > 0)
  if (relevant.length === 0) return chart

  const filtered = chart.series.map((s) => ({
    ...s,
    data: s.data.filter((point) => {
      // All relevant filters must be satisfied (AND).
      return relevant.every((f) => matches(point.label, f))
    }),
  }))

  return { ...chart, series: filtered }
}

function matches(label: string, f: DashboardFilter): boolean {
  switch (f.operator) {
    case 'in':     return f.values.includes(label)
    case 'not_in': return !f.values.includes(label)
    case 'eq':     return f.values[0] === label
    case 'neq':    return f.values[0] !== label
    case 'between': {
      // values = [start, end]; either bound may be empty meaning open.
      const [start, end] = f.values
      if (start && label < start) return false
      if (end && label > end) return false
      return true
    }
  }
}
