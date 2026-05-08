// Chart factory — dispatches by chart type. Each renderer mounts into the
// passed element and returns a handle with destroy() so the editor can
// rebuild a chart without leaking Highcharts/Jspreadsheet instances.

import Highcharts from 'highcharts'
import jspreadsheet from 'jspreadsheet'
import type { DashboardChartRecord, ChartDataSeries } from '../domain'
import { paletteFor } from './palette'

export interface ChartHandle {
  destroy: () => void
}

export function renderChart(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  el.innerHTML = '' // clear previous render
  switch (chart.dashboard_chart_type) {
    case 'bar':   return renderBar(el, chart)
    case 'line':  return renderLine(el, chart)
    case 'pie':   return renderPie(el, chart)
    case 'kpi':   return renderKpi(el, chart)
    case 'table': return renderTable(el, chart)
    default: {
      el.innerHTML = `<div class="dashjs-chart__placeholder">Unsupported chart type: ${(chart as any).dashboard_chart_type}</div>`
      return { destroy: () => { el.innerHTML = '' } }
    }
  }
}

// --- helpers ---

function firstSeries(chart: DashboardChartRecord): ChartDataSeries | null {
  return chart.series && chart.series[0] ? chart.series[0] : null
}

function formatValue(v: number, format?: string): string {
  if (format === 'percent') return v.toFixed(1) + '%'
  if (format === 'decimal1') return v.toFixed(1)
  if (format === 'decimal2') return v.toFixed(2)
  return String(Math.round(v))
}

function commonOptions(chart: DashboardChartRecord): Partial<Highcharts.Options> {
  return {
    chart: { backgroundColor: 'transparent' },
    title: { text: undefined },
    credits: { enabled: false },
  }
}

// --- renderers ---

function renderBar(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const showValues = labels.showValues ?? true
  const showLegend = labels.showLegend ?? false
  const valueFormat = labels.valueFormat ?? 'number'

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: 'column', backgroundColor: 'transparent' },
    legend: { enabled: showLegend },
    xAxis: {
      categories: series?.data.map((d) => d.label) ?? [],
      labels: { style: { color: 'var(--dashjs-text-muted)', fontSize: '11px' } },
      lineColor: 'var(--dashjs-border)',
    },
    yAxis: {
      title: { text: undefined },
      gridLineColor: 'var(--dashjs-border)',
      labels: { style: { color: 'var(--dashjs-text-muted)', fontSize: '11px' } },
    },
    tooltip: {
      formatter: function (this: any) {
        return `<b>${this.x}</b><br>${formatValue(this.y, valueFormat)}`
      },
    },
    plotOptions: {
      column: {
        borderRadius: 4,
        colorByPoint: true,
        colors: palette,
        dataLabels: {
          enabled: showValues,
          formatter: function (this: any) { return formatValue(this.y, valueFormat) },
          style: { color: 'var(--dashjs-text)', textOutline: 'none', fontSize: '11px', fontWeight: '500' },
        },
      },
    },
    series: [{ type: 'column', name: series?.name ?? '', data: series?.data.map((d) => d.value) ?? [] }],
  })

  return { destroy: () => hc.destroy() }
}

function renderLine(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const showLegend = labels.showLegend ?? true
  const legendPos = labels.legendPosition ?? 'bottom'
  const valueFormat = labels.valueFormat ?? 'number'

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: 'line', backgroundColor: 'transparent' },
    legend: {
      enabled: showLegend,
      align: legendPos === 'left' || legendPos === 'right' ? legendPos : 'center',
      verticalAlign: legendPos === 'top' || legendPos === 'bottom' ? legendPos : 'middle',
      layout: legendPos === 'left' || legendPos === 'right' ? 'vertical' : 'horizontal',
      itemStyle: { color: 'var(--dashjs-text)' },
    },
    xAxis: {
      categories: series?.data.map((d) => d.label) ?? [],
      labels: { style: { color: 'var(--dashjs-text-muted)', fontSize: '11px' } },
      lineColor: 'var(--dashjs-border)',
    },
    yAxis: {
      title: { text: undefined },
      gridLineColor: 'var(--dashjs-border)',
      labels: { style: { color: 'var(--dashjs-text-muted)', fontSize: '11px' } },
    },
    tooltip: {
      formatter: function (this: any) {
        return `<b>${this.x}</b><br>${formatValue(this.y, valueFormat)}`
      },
    },
    plotOptions: {
      line: {
        marker: { enabled: true, radius: 4 },
        lineWidth: 2,
        color: palette[0],
      },
    },
    series: [{ type: 'line', name: series?.name ?? '', data: series?.data.map((d) => d.value) ?? [] }],
  })

  return { destroy: () => hc.destroy() }
}

function renderPie(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const showLegend = labels.showLegend ?? true
  const legendPos = labels.legendPosition ?? 'right'
  const valueFormat = labels.valueFormat ?? 'percent'

  const total = series?.data.reduce((s, d) => s + d.value, 0) ?? 1

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: 'pie', backgroundColor: 'transparent' },
    legend: {
      enabled: showLegend,
      align: legendPos === 'left' || legendPos === 'right' ? legendPos : 'center',
      verticalAlign: legendPos === 'top' || legendPos === 'bottom' ? legendPos : 'middle',
      layout: legendPos === 'left' || legendPos === 'right' ? 'vertical' : 'horizontal',
      itemStyle: { color: 'var(--dashjs-text)' },
    },
    tooltip: {
      formatter: function (this: any) {
        const pct = (this.y / total) * 100
        return `<b>${this.point.name}</b><br>${this.y} (${formatValue(pct, 'decimal1')}%)`
      },
    },
    plotOptions: {
      pie: {
        colors: palette,
        dataLabels: {
          enabled: labels.showValues ?? true,
          formatter: function (this: any) {
            const pct = (this.y / total) * 100
            return valueFormat === 'percent' ? `${this.point.name}: ${pct.toFixed(1)}%` : `${this.point.name}: ${this.y}`
          },
          style: { color: 'var(--dashjs-text)', textOutline: 'none', fontSize: '11px' },
        },
      },
    },
    series: [{
      type: 'pie',
      name: series?.name ?? '',
      data: (series?.data ?? []).map((d) => ({ name: d.label, y: d.value })),
    }],
  })

  return { destroy: () => hc.destroy() }
}

function renderKpi(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const valueFormat = labels.valueFormat ?? 'number'
  const value = chart.kpi_value ?? 0
  const sublabel = chart.kpi_label ?? ''

  el.innerHTML = `
    <div class="dashjs-kpi">
      <div class="dashjs-kpi__value">${formatValue(value, valueFormat)}</div>
      ${sublabel ? `<div class="dashjs-kpi__label">${escapeHtml(sublabel)}</div>` : ''}
    </div>
  `

  return { destroy: () => { el.innerHTML = '' } }
}

function renderTable(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  if (!series) {
    el.innerHTML = `<div class="dashjs-chart__placeholder">No data</div>`
    return { destroy: () => { el.innerHTML = '' } }
  }
  const total = series.data.reduce((s, d) => s + d.value, 0) || 1
  const data = series.data.map((d) => [d.label, d.value, ((d.value / total) * 100).toFixed(1) + '%'])

  jspreadsheet(el, {
    worksheets: [{
      data,
      columns: [
        { type: 'text', title: 'Label', width: 220, readOnly: true },
        { type: 'numeric', title: 'Value', width: 100, readOnly: true },
        { type: 'text', title: '% of total', width: 110, readOnly: true },
      ],
      allowInsertRow: false,
      allowDeleteRow: false,
      allowInsertColumn: false,
      allowDeleteColumn: false,
      allowRenameColumn: false,
      columnSorting: true,
    }],
  })

  return {
    destroy: () => {
      try { jspreadsheet.destroy(el as any) } catch { /* already destroyed */ }
      el.innerHTML = ''
    },
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
