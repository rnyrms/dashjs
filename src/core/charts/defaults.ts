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

// Two related series sharing the same x-axis categories — used by stackedBar
// so the chart visibly stacks segments rather than looking like a plain bar.
const SAMPLE_STACKED = [
  {
    name: 'New',
    data: [
      { label: 'Strongly agree', value: 80 },
      { label: 'Agree', value: 140 },
      { label: 'Neutral', value: 70 },
      { label: 'Disagree', value: 32 },
      { label: 'Strongly disagree', value: 12 },
    ],
  },
  {
    name: 'Returning',
    data: [
      { label: 'Strongly agree', value: 62 },
      { label: 'Agree', value: 138 },
      { label: 'Neutral', value: 61 },
      { label: 'Disagree', value: 32 },
      { label: 'Strongly disagree', value: 14 },
    ],
  },
]

const SAMPLE_FUNNEL = [
  { label: 'Site visits',  value: 1000 },
  { label: 'Sign-ups',     value: 420 },
  { label: 'Activated',    value: 210 },
  { label: 'Paid plan',    value: 95 },
  { label: 'Renewed',      value: 64 },
]

const SAMPLE_WATERFALL = [
  { label: 'Start',          value: 120 },
  { label: 'Onboarding',     value: 42 },
  { label: 'Activation',     value: -18 },
  { label: 'Upsell',         value: 30 },
  { label: 'Churn',          value: -25 },
  { label: 'End',            value: 149 },
]

const SAMPLE_WORDS = [
  { label: 'fast',          value: 32 },
  { label: 'reliable',      value: 28 },
  { label: 'expensive',     value: 21 },
  { label: 'easy',          value: 19 },
  { label: 'powerful',      value: 17 },
  { label: 'confusing',     value: 12 },
  { label: 'great support', value: 10 },
  { label: 'slow',          value: 8 },
  { label: 'modern',        value: 7 },
  { label: 'flexible',      value: 6 },
]

const SAMPLE_TIMELINE = [
  { label: 'Q1 — Beta launch',         value: 1 },
  { label: 'Q2 — Public v1',           value: 2 },
  { label: 'Q3 — Team plan',           value: 3 },
  { label: 'Q4 — Enterprise',          value: 4 },
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
    case 'donut':
      return {
        ...base,
        dashboard_chart_type: 'donut',
        dashboard_chart_title: 'Donut chart',
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
    case 'area':
      return {
        ...base,
        dashboard_chart_type: 'area',
        dashboard_chart_title: 'Area chart',
        dashboard_chart_w: 12,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'count',
          labels: { showValues: false, showLegend: true, legendPosition: 'bottom', valueFormat: 'number' },
        },
        series: [{ name: 'Series', data: SAMPLE_TIME_SERIES }],
      }
    case 'horizontalBar':
      return {
        ...base,
        dashboard_chart_type: 'horizontalBar',
        dashboard_chart_title: 'Horizontal bar chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'count',
          labels: { showValues: true, showLegend: false, valueFormat: 'number' },
        },
        series: [{ name: 'Series', data: SAMPLE_CATEGORICAL }],
      }
    case 'stackedBar':
      return {
        ...base,
        dashboard_chart_type: 'stackedBar',
        dashboard_chart_title: 'Stacked bar chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'count',
          labels: { showValues: false, showLegend: true, legendPosition: 'bottom', valueFormat: 'number' },
        },
        series: SAMPLE_STACKED,
      }
    case 'stackedBarPercent':
      return {
        ...base,
        dashboard_chart_type: 'stackedBarPercent',
        dashboard_chart_title: '100% stacked bar',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'count',
          labels: { showValues: false, showLegend: true, legendPosition: 'bottom', valueFormat: 'percent' },
        },
        series: SAMPLE_STACKED,
      }
    case 'stackedHorizontalBar':
      return {
        ...base,
        dashboard_chart_type: 'stackedHorizontalBar',
        dashboard_chart_title: 'Stacked horizontal bar',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'count',
          labels: { showValues: false, showLegend: true, legendPosition: 'bottom', valueFormat: 'number' },
        },
        series: SAMPLE_STACKED,
      }
    case 'lollipop':
      return {
        ...base,
        dashboard_chart_type: 'lollipop',
        dashboard_chart_title: 'Lollipop chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_CATEGORICAL }],
      }
    case 'spline':
      return {
        ...base,
        dashboard_chart_type: 'spline',
        dashboard_chart_title: 'Spline chart',
        dashboard_chart_w: 12,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'count',
          labels: { showValues: false, showLegend: true, legendPosition: 'bottom', valueFormat: 'number' },
        },
        series: [{ name: 'Series', data: SAMPLE_TIME_SERIES }],
      }
    case 'areaSpline':
      return {
        ...base,
        dashboard_chart_type: 'areaSpline',
        dashboard_chart_title: 'Area spline chart',
        dashboard_chart_w: 12,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'count',
          labels: { showValues: false, showLegend: true, legendPosition: 'bottom', valueFormat: 'number' },
        },
        series: [{ name: 'Series', data: SAMPLE_TIME_SERIES }],
      }
    case 'stackedArea':
      return {
        ...base,
        dashboard_chart_type: 'stackedArea',
        dashboard_chart_title: 'Stacked area chart',
        dashboard_chart_w: 12,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'count',
          labels: { showValues: false, showLegend: true, legendPosition: 'bottom', valueFormat: 'number' },
        },
        series: SAMPLE_STACKED,
      }
    case 'semicircle':
      return {
        ...base,
        dashboard_chart_type: 'semicircle',
        dashboard_chart_title: 'Semicircle chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'percentage',
          labels: { showValues: true, showLegend: true, legendPosition: 'bottom', valueFormat: 'percent' },
        },
        series: [{ name: 'Series', data: SAMPLE_PIE }],
      }
    case 'variablePie':
      return {
        ...base,
        dashboard_chart_type: 'variablePie',
        dashboard_chart_title: 'Variable pie',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: {
          aggregation: 'percentage',
          labels: { showValues: false, showLegend: true, legendPosition: 'right', valueFormat: 'percent' },
        },
        series: [{ name: 'Series', data: SAMPLE_PIE }],
      }
    case 'scatter':
      return {
        ...base,
        dashboard_chart_type: 'scatter',
        dashboard_chart_title: 'Scatter chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_TIME_SERIES }],
      }
    case 'bubble':
      return {
        ...base,
        dashboard_chart_type: 'bubble',
        dashboard_chart_title: 'Bubble chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_CATEGORICAL }],
      }
    case 'treemap':
      return {
        ...base,
        dashboard_chart_type: 'treemap',
        dashboard_chart_title: 'Treemap',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_PIE }],
      }
    case 'heatmap':
      return {
        ...base,
        dashboard_chart_type: 'heatmap',
        dashboard_chart_title: 'Heatmap',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_TIME_SERIES }],
      }
    case 'sunburst':
      return {
        ...base,
        dashboard_chart_type: 'sunburst',
        dashboard_chart_title: 'Sunburst',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_PIE }],
      }
    case 'funnel':
      return {
        ...base,
        dashboard_chart_type: 'funnel',
        dashboard_chart_title: 'Funnel chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_FUNNEL }],
      }
    case 'pyramid':
      return {
        ...base,
        dashboard_chart_type: 'pyramid',
        dashboard_chart_title: 'Pyramid chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_FUNNEL.slice().reverse() }],
      }
    case 'sankey':
      return {
        ...base,
        dashboard_chart_type: 'sankey',
        dashboard_chart_title: 'Sankey diagram',
        dashboard_chart_w: 12,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_FUNNEL }],
      }
    case 'timeline':
      return {
        ...base,
        dashboard_chart_type: 'timeline',
        dashboard_chart_title: 'Timeline',
        dashboard_chart_w: 12,
        dashboard_chart_h: 3,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_TIMELINE }],
      }
    case 'wordcloud':
      return {
        ...base,
        dashboard_chart_type: 'wordcloud',
        dashboard_chart_title: 'Word cloud',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'count' },
        series: [{ name: 'Series', data: SAMPLE_WORDS }],
      }
    case 'gauge':
      return {
        ...base,
        dashboard_chart_type: 'gauge',
        dashboard_chart_title: 'Gauge',
        dashboard_chart_w: 4,
        dashboard_chart_h: 3,
        dashboard_chart_config: { aggregation: 'mean', labels: { valueFormat: 'number' } },
        kpi_value: 68,
        series: [{ name: 'Series', data: [{ label: 'Score', value: 68 }] }],
      }
    case 'waterfall':
      return {
        ...base,
        dashboard_chart_type: 'waterfall',
        dashboard_chart_title: 'Waterfall chart',
        dashboard_chart_w: 6,
        dashboard_chart_h: 4,
        dashboard_chart_config: { aggregation: 'sum' },
        series: [{ name: 'Series', data: SAMPLE_WATERFALL }],
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
