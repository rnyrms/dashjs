// Default factory for new charts created via the toolbar's "Add a chart" tray.
// Produces a complete DashboardChartRecord with sensible config + sample series
// so the chart renders something on the canvas immediately. The user then
// configures dimension/aggregation/etc. via the Properties panel.

import type { DashboardChartRecord, ChartType } from '../domain'

export interface NewChartPosition {
  pageId: number
  x: number
  y: number
}

const SAMPLE_CATEGORICAL = [
  { label: 'Strongly agree',     value: 142 },
  { label: 'Agree',              value: 278 },
  { label: 'Neutral',            value: 131 },
  { label: 'Disagree',           value: 64 },
  { label: 'Strongly disagree',  value: 26 },
]

const SAMPLE_TIME_SERIES = [
  { label: 'Mon', value: 78 },
  { label: 'Tue', value: 92 },
  { label: 'Wed', value: 104 },
  { label: 'Thu', value: 88 },
  { label: 'Fri', value: 121 },
  { label: 'Sat', value: 95 },
  { label: 'Sun', value: 63 },
]

const SAMPLE_PIE = [
  { label: 'Free',       value: 312 },
  { label: 'Pro',        value: 218 },
  { label: 'Team',       value: 76 },
  { label: 'Enterprise', value: 35 },
]

/**
 * Build a default chart of the given type at the given grid position.
 * Caller is responsible for picking a non-conflicting `dashboard_chart_id`.
 */
export function createDefaultChart(
  type: ChartType,
  id: number,
  pos: NewChartPosition,
): DashboardChartRecord {
  const base: Pick<DashboardChartRecord, 'dashboard_chart_id' | 'dashboard_page_id' | 'dashboard_chart_x' | 'dashboard_chart_y'> = {
    dashboard_chart_id: id,
    dashboard_page_id: pos.pageId,
    dashboard_chart_x: pos.x,
    dashboard_chart_y: pos.y,
  }

  switch (type) {
    case 'kpi':
      return {
        ...base,
        dashboard_chart_type: 'kpi',
        dashboard_chart_title: 'KPI',
        dashboard_chart_w: 3,
        dashboard_chart_h: 2,
        dashboard_chart_config: { aggregation: 'count', labels: { valueFormat: 'number' } },
        kpi_value: 100,
        kpi_label: 'sample metric',
      }
    case 'pie':
      return {
        ...base,
        dashboard_chart_type: 'pie',
        dashboard_chart_title: 'Pie chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'percentage',
          labels: { showValues: true, showLegend: true, legendPosition: 'right', valueFormat: 'percent' },
        },
        series: [{ name: 'Series', data: SAMPLE_PIE }],
      }
    case 'line':
      return {
        ...base,
        dashboard_chart_type: 'line',
        dashboard_chart_title: 'Line chart',
        dashboard_chart_w: 12,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'count',
          labels: { showValues: false, showLegend: true, legendPosition: 'bottom', valueFormat: 'number' },
        },
        series: [{ name: 'Series', data: SAMPLE_TIME_SERIES }],
      }
    case 'table':
      return {
        ...base,
        dashboard_chart_type: 'table',
        dashboard_chart_title: 'Table',
        dashboard_chart_w: 12,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_CATEGORICAL }],
      }
    case 'bar':
    default:
      return {
        ...base,
        dashboard_chart_type: 'bar',
        dashboard_chart_title: 'Bar chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'count',
          labels: { showValues: true, showLegend: false, valueFormat: 'number' },
        },
        series: [{ name: 'Series', data: SAMPLE_CATEGORICAL }],
      }
  }
}
