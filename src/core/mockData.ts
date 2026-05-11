// Mock data for the editor UI. Used when no DashJsDataSource is supplied
// to dashjs(). When a host wires up a real data source (Phase F), the
// editor calls dataSource.listFields() and dataSource.getChartData()
// instead of using these constants.

import type { DashboardFull } from './domain'
import type { DataField, FieldType } from './types'

// Re-export so existing imports of DataField/FieldType from mockData
// keep compiling — the canonical location is now ./types.
export type { DataField, FieldType }

export const MOCK_FIELDS: DataField[] = [
  { id: 'q1', name: 'Achievement ID', type: 'text' },
  { id: 'q2', name: 'Ad format', type: 'text' },
  { id: 'q3', name: 'Ad source', type: 'text' },
  { id: 'q4', name: 'Ad unit', type: 'text' },
  { id: 'q5', name: 'Age', type: 'numeric' },
  { id: 'q6', name: 'App version', type: 'text' },
  { id: 'q7', name: 'Audience ID', type: 'text' },
  { id: 'q8', name: 'Audience name', type: 'text' },
  { id: 'q9', name: 'Browser', type: 'text' },
  { id: 'q10', name: 'Campaign', type: 'text' },
  { id: 'q11', name: 'Campaign ID', type: 'text' },
  { id: 'q12', name: 'Character', type: 'text' },
  { id: 'q13', name: 'City', type: 'geo' },
  { id: 'q14', name: 'City ID', type: 'text' },
  { id: 'q15', name: 'Date', type: 'date' },
  { id: 'q16', name: 'Sessions', type: 'numeric' },
  { id: 'q17', name: 'Customer satisfaction', type: 'scale' },
  { id: 'q18', name: 'Favourite features', type: 'multi' },
  { id: 'q19', name: 'Plan tier', type: 'single' },
  { id: 'q20', name: 'Country', type: 'geo' },
]

/** Short type badge label shown in the data field list (Looker-style ABC / 123). */
export function fieldTypeBadge(type: FieldType): { label: string; color: string } {
  switch (type) {
    case 'text':    return { label: 'ABC', color: '#0d9d58' }
    case 'numeric': return { label: '123', color: '#1a73e8' }
    case 'single':  return { label: '○',   color: '#a142f4' }
    case 'multi':   return { label: '☐',   color: '#a142f4' }
    case 'scale':   return { label: '↕',   color: '#f4b400' }
    case 'date':    return { label: '📅',  color: '#ea4335' }
    case 'geo':     return { label: '◎',   color: '#34a853' }
  }
}

/** A complete demo dashboard with one page and four charts of different types,
 *  each with pre-computed series. Used by the demo and as the default when no
 *  dashboard is supplied to the editor. */
export const MOCK_DASHBOARD: DashboardFull = {
  dashboard_id: 1,
  dashboard_name: 'Q1 Customer Satisfaction',
  survey_name: 'CSAT 2026',
  dashboard_updated: '2026-04-21 14:32',
  filters: [],
  pages: [
    {
      dashboard_page_id: 1,
      dashboard_page_name: 'Overview',
      charts: [
        {
          dashboard_chart_id: 101,
          dashboard_page_id: 1,
          dashboard_chart_type: 'kpi',
          dashboard_chart_title: 'Total responses',
          dashboard_chart_x: 0,
          dashboard_chart_y: 0,
          dashboard_chart_w: 3,
          dashboard_chart_h: 2,
          dashboard_chart_config: {
            aggregation: 'count',
            labels: { valueFormat: 'number' },
          },
          kpi_value: 641,
          kpi_label: 'responses · last 30 days',
        },
        {
          dashboard_chart_id: 102,
          dashboard_page_id: 1,
          dashboard_chart_type: 'kpi',
          dashboard_chart_title: 'Average score',
          dashboard_chart_x: 3,
          dashboard_chart_y: 0,
          dashboard_chart_w: 3,
          dashboard_chart_h: 2,
          dashboard_chart_config: {
            aggregation: 'mean',
            labels: { valueFormat: 'decimal1' },
          },
          kpi_value: 4.2,
          kpi_label: 'out of 5',
        },
        {
          dashboard_chart_id: 103,
          dashboard_page_id: 1,
          dashboard_chart_type: 'bar',
          dashboard_chart_title: 'Customer satisfaction breakdown',
          dashboard_chart_x: 0,
          dashboard_chart_y: 2,
          dashboard_chart_w: 6,
          dashboard_chart_h: 4,
          dashboard_chart_config: {
            dimension: { questionCode: 'q17', questionText: 'Customer satisfaction', questionId: 17 },
            aggregation: 'count',
            labels: { showValues: true, showLegend: false, valueFormat: 'number' },
          },
          series: [
            {
              name: 'Responses',
              data: [
                { label: 'Strongly agree', value: 142 },
                { label: 'Agree', value: 278 },
                { label: 'Neutral', value: 131 },
                { label: 'Disagree', value: 64 },
                { label: 'Strongly disagree', value: 26 },
              ],
            },
          ],
        },
        {
          dashboard_chart_id: 104,
          dashboard_page_id: 1,
          dashboard_chart_type: 'pie',
          dashboard_chart_title: 'Plan tier distribution',
          dashboard_chart_x: 6,
          dashboard_chart_y: 2,
          dashboard_chart_w: 6,
          dashboard_chart_h: 4,
          dashboard_chart_config: {
            dimension: { questionCode: 'q19', questionText: 'Plan tier', questionId: 19 },
            aggregation: 'percentage',
            labels: { showValues: true, showLegend: true, legendPosition: 'right', valueFormat: 'percent' },
          },
          series: [
            {
              name: 'Plan',
              data: [
                { label: 'Free', value: 312 },
                { label: 'Pro', value: 218 },
                { label: 'Team', value: 76 },
                { label: 'Enterprise', value: 35 },
              ],
            },
          ],
        },
        {
          dashboard_chart_id: 105,
          dashboard_page_id: 1,
          dashboard_chart_type: 'line',
          dashboard_chart_title: 'Daily responses (last 7 days)',
          dashboard_chart_x: 0,
          dashboard_chart_y: 6,
          dashboard_chart_w: 12,
          dashboard_chart_h: 4,
          dashboard_chart_config: {
            dimension: { questionCode: 'q15', questionText: 'Date', questionId: 15 },
            aggregation: 'count',
            labels: { showValues: false, showLegend: true, legendPosition: 'bottom', valueFormat: 'number' },
          },
          series: [
            {
              name: 'Responses',
              data: [
                { label: 'Apr 15', value: 78 },
                { label: 'Apr 16', value: 92 },
                { label: 'Apr 17', value: 104 },
                { label: 'Apr 18', value: 88 },
                { label: 'Apr 19', value: 121 },
                { label: 'Apr 20', value: 95 },
                { label: 'Apr 21', value: 63 },
              ],
            },
          ],
        },
        {
          dashboard_chart_id: 106,
          dashboard_page_id: 1,
          dashboard_chart_type: 'table',
          dashboard_chart_title: 'Response data',
          dashboard_chart_x: 0,
          dashboard_chart_y: 10,
          dashboard_chart_w: 12,
          dashboard_chart_h: 4,
          dashboard_chart_config: {
            dimension: { questionCode: 'q17', questionText: 'Customer satisfaction', questionId: 17 },
            aggregation: 'count',
          },
          series: [
            {
              name: 'Responses',
              data: [
                { label: 'Strongly agree', value: 142 },
                { label: 'Agree', value: 278 },
                { label: 'Neutral', value: 131 },
                { label: 'Disagree', value: 64 },
                { label: 'Strongly disagree', value: 26 },
              ],
            },
          ],
        },
      ],
    },
  ],
}
