// DashboardViewer — renders a single dashboard with chart + data table.
// Phase 2 minimum: prove the rendering pipeline works end-to-end.
//   - Highcharts (vanilla) for the chart
//   - Jspreadsheet for the data table
//   - Lucide for icons in the header

import Highcharts from 'highcharts'
import jspreadsheet from 'jspreadsheet'
import type { DashboardFull } from '../domain'
import { icon } from '../icons'

export interface DashboardViewerContext {
  dashboard: DashboardFull
  dictionary?: Record<string, string>
}

interface ChartSeries {
  name: string
  data: { label: string; value: number }[]
}

const SAMPLE_SERIES: ChartSeries[] = [
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
]

const PALETTE = ['#2383E2', '#6940A5', '#D44C47', '#CB7B37', '#448361']

export class DashboardViewer {
  private root: HTMLElement
  private ctx: DashboardViewerContext
  private chartEl: HTMLElement | null = null
  private tableEl: HTMLElement | null = null
  private chart: Highcharts.Chart | null = null
  private worksheets: ReturnType<typeof jspreadsheet> | null = null

  constructor(root: HTMLElement, ctx: DashboardViewerContext) {
    this.root = root
    this.ctx = ctx
  }

  render(): void {
    const t = (key: string, fallback: string) => this.ctx.dictionary?.[key] ?? fallback
    const d = this.ctx.dashboard

    this.root.innerHTML = `
      <div class="dashjs-viewer">
        <div class="dashjs-viewer__header">
          <div>
            <h1 class="dashjs-viewer__title">${escape(d.dashboard_name)}</h1>
            <div class="dashjs-viewer__subtitle">
              ${d.survey_name ? escape(d.survey_name) + ' · ' : ''}${d.dashboard_updated ?? ''}
            </div>
          </div>
          <div class="dashjs-viewer__actions">
            <button class="dashjs-btn dashjs-btn--icon" title="${t('viewer.share', 'Share')}">
              ${icon('share', { size: 16 })}
            </button>
            <button class="dashjs-btn dashjs-btn--icon" title="${t('viewer.settings', 'Settings')}">
              ${icon('settings', { size: 16 })}
            </button>
          </div>
        </div>

        <div class="dashjs-viewer__grid">
          <div class="dashjs-card">
            <div class="dashjs-card__title">${t('viewer.chartTitle', 'Customer satisfaction breakdown')}</div>
            <div class="dashjs-card__body" data-chart></div>
          </div>

          <div class="dashjs-card">
            <div class="dashjs-card__title">${t('viewer.tableTitle', 'Response data')}</div>
            <div class="dashjs-card__body" data-table></div>
          </div>
        </div>
      </div>
    `

    this.chartEl = this.root.querySelector<HTMLElement>('[data-chart]')
    this.tableEl = this.root.querySelector<HTMLElement>('[data-table]')
    this.mountChart()
    this.mountTable()
  }

  destroy(): void {
    if (this.chart) {
      this.chart.destroy()
      this.chart = null
    }
    if (this.tableEl) {
      try {
        jspreadsheet.destroy(this.tableEl as any)
      } catch {
        // already destroyed
      }
    }
    this.root.innerHTML = ''
  }

  // --- private ---

  private mountChart(): void {
    if (!this.chartEl) return
    const series = SAMPLE_SERIES[0]
    this.chart = Highcharts.chart(this.chartEl, {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
        height: 320,
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: series.data.map((d) => d.label),
        labels: { style: { color: 'var(--dashjs-text-muted)', fontSize: '12px' } },
        lineColor: 'var(--dashjs-border)',
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: 'var(--dashjs-border)',
        labels: { style: { color: 'var(--dashjs-text-muted)', fontSize: '12px' } },
      },
      tooltip: {
        valueSuffix: ' responses',
      },
      plotOptions: {
        column: {
          borderRadius: 4,
          colorByPoint: true,
          colors: PALETTE,
          dataLabels: {
            enabled: true,
            style: { color: 'var(--dashjs-text)', textOutline: 'none', fontSize: '11px' },
          },
        },
      },
      series: [
        {
          type: 'column',
          name: series.name,
          data: series.data.map((d) => d.value),
        },
      ],
    })
  }

  private mountTable(): void {
    if (!this.tableEl) return
    const series = SAMPLE_SERIES[0]
    const total = series.data.reduce((s, d) => s + d.value, 0)
    const data = series.data.map((d) => [
      d.label,
      d.value,
      ((d.value / total) * 100).toFixed(1) + '%',
    ])

    this.worksheets = jspreadsheet(this.tableEl, {
      worksheets: [
        {
          data,
          columns: [
            { type: 'text', title: 'Response', width: 220, readOnly: true },
            { type: 'numeric', title: 'Count', width: 100, readOnly: true },
            { type: 'text', title: '% of total', width: 110, readOnly: true },
          ],
          allowInsertRow: false,
          allowDeleteRow: false,
          allowInsertColumn: false,
          allowDeleteColumn: false,
          allowRenameColumn: false,
          columnSorting: true,
        },
      ],
    })
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
