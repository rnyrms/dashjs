// Chart factory — dispatches by chart type. Each renderer mounts into the
// passed element and returns a handle with destroy() so the editor can
// rebuild a chart without leaking Highcharts/Jspreadsheet instances.

import Highcharts from 'highcharts/esm/highcharts'
// Side-effect imports: each module attaches its series types to the
// shared Highcharts instance. ESM build paths are required — the legacy
// UMD modules read from a `_Highcharts` global that's never set in a
// Vite/ESM context.
import 'highcharts/esm/highcharts-more'
import 'highcharts/esm/modules/solid-gauge'
import 'highcharts/esm/modules/funnel'
import 'highcharts/esm/modules/treemap'
import 'highcharts/esm/modules/heatmap'
import 'highcharts/esm/modules/sunburst'
import 'highcharts/esm/modules/sankey'
import 'highcharts/esm/modules/timeline'
import 'highcharts/esm/modules/wordcloud'
import 'highcharts/esm/modules/variable-pie'
// Lollipop extends Dumbbell — must be loaded first or its prototype lookup
// throws "Cannot read properties of undefined (reading 'prototype')".
import 'highcharts/esm/modules/dumbbell'
import 'highcharts/esm/modules/lollipop'
import jspreadsheet from 'jspreadsheet'
import type { DashboardChartRecord, ChartDataSeries } from '../domain'
import { paletteFor } from './palette'

export interface ChartHandle {
  destroy: () => void
}

export function renderChart(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  el.innerHTML = '' // clear previous render
  switch (chart.dashboard_chart_type) {
    // Bar family
    case 'bar':                  return renderBar(el, chart, { orientation: 'vertical' })
    case 'horizontalBar':        return renderBar(el, chart, { orientation: 'horizontal' })
    case 'stackedBar':           return renderBar(el, chart, { orientation: 'vertical',   stacked: 'normal' })
    case 'stackedBarPercent':    return renderBar(el, chart, { orientation: 'vertical',   stacked: 'percent' })
    case 'stackedHorizontalBar': return renderBar(el, chart, { orientation: 'horizontal', stacked: 'normal' })
    case 'lollipop':             return renderLollipop(el, chart)
    // Line family
    case 'line':                 return renderLine(el, chart, { variant: 'line' })
    case 'spline':               return renderLine(el, chart, { variant: 'spline' })
    case 'area':                 return renderLine(el, chart, { variant: 'area' })
    case 'areaSpline':           return renderLine(el, chart, { variant: 'areaspline' })
    case 'stackedArea':          return renderLine(el, chart, { variant: 'area', stacked: true })
    // Pie family
    case 'pie':                  return renderPie(el, chart, { variant: 'pie' })
    case 'donut':                return renderPie(el, chart, { variant: 'donut' })
    case 'semicircle':           return renderPie(el, chart, { variant: 'semicircle' })
    case 'variablePie':          return renderVariablePie(el, chart)
    // Scatter family
    case 'scatter':              return renderScatter(el, chart, { bubble: false })
    case 'bubble':               return renderScatter(el, chart, { bubble: true })
    // Hierarchy / matrix
    case 'treemap':              return renderTreemap(el, chart)
    case 'heatmap':              return renderHeatmap(el, chart)
    case 'sunburst':             return renderSunburst(el, chart)
    // Flow / specialty
    case 'funnel':               return renderFunnelLike(el, chart, 'funnel')
    case 'pyramid':              return renderFunnelLike(el, chart, 'pyramid')
    case 'sankey':               return renderSankey(el, chart)
    case 'timeline':             return renderTimeline(el, chart)
    case 'wordcloud':            return renderWordcloud(el, chart)
    case 'gauge':                return renderGauge(el, chart)
    case 'waterfall':            return renderWaterfall(el, chart)
    // Display
    case 'kpi':                  return renderKpi(el, chart)
    case 'table':                return renderTable(el, chart)
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

interface BarOptions {
  orientation: 'vertical' | 'horizontal'
  stacked?: 'normal' | 'percent'
}

function renderBar(el: HTMLElement, chart: DashboardChartRecord, opts: BarOptions): ChartHandle {
  const allSeries = chart.series ?? []
  const series = allSeries[0] ?? null
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const showValues = labels.showValues ?? true
  // Stacked + multi-series: legend on by default so users can tell series apart.
  const showLegend = labels.showLegend ?? (!!opts.stacked && allSeries.length > 1)
  const valueFormat = labels.valueFormat ?? (opts.stacked === 'percent' ? 'percent' : 'number')

  // Highcharts naming: `bar` is horizontal, `column` is vertical.
  const hcType: 'bar' | 'column' = opts.orientation === 'horizontal' ? 'bar' : 'column'
  // Categories come from the first series' labels — all series must share x-axis.
  const categories = series?.data.map((d) => d.label) ?? []

  // For stacked with multi-series, emit one Highcharts series per data series
  // and colour each from the palette. For single-series we colour by point so
  // each bar gets its own colour (Looker-style).
  const seriesConfig = opts.stacked && allSeries.length > 1
    ? allSeries.map((s, i) => ({
        type: hcType,
        name: s.name,
        color: palette[i % palette.length],
        data: s.data.map((d) => d.value),
      }))
    : [{
        type: hcType,
        name: series?.name ?? '',
        data: series?.data.map((d) => d.value) ?? [],
      }]

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: hcType, backgroundColor: 'transparent' },
    legend: { enabled: showLegend, itemStyle: { color: 'var(--dashjs-text)' } },
    xAxis: {
      categories,
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
        return `<b>${this.x}</b><br>${this.series.name ? this.series.name + ': ' : ''}${formatValue(this.y, valueFormat)}`
      },
    },
    plotOptions: {
      column: {
        borderRadius: 4,
        colorByPoint: !opts.stacked || allSeries.length <= 1,
        colors: palette,
        stacking: opts.stacked,
        dataLabels: {
          enabled: showValues,
          formatter: function (this: any) { return formatValue(this.y, valueFormat) },
          style: { color: 'var(--dashjs-text)', textOutline: 'none', fontSize: '11px', fontWeight: '500' },
        },
      },
      bar: {
        borderRadius: 4,
        colorByPoint: !opts.stacked || allSeries.length <= 1,
        colors: palette,
        stacking: opts.stacked,
        dataLabels: {
          enabled: showValues,
          formatter: function (this: any) { return formatValue(this.y, valueFormat) },
          style: { color: 'var(--dashjs-text)', textOutline: 'none', fontSize: '11px', fontWeight: '500' },
        },
      },
    },
    series: seriesConfig,
  })

  return { destroy: () => hc.destroy() }
}

interface LineOptions {
  variant: 'line' | 'spline' | 'area' | 'areaspline'
  stacked?: boolean
}

function renderLine(el: HTMLElement, chart: DashboardChartRecord, opts: LineOptions): ChartHandle {
  const allSeries = chart.series ?? []
  const series = allSeries[0] ?? null
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const showLegend = labels.showLegend ?? true
  const legendPos = labels.legendPosition ?? 'bottom'
  const valueFormat = labels.valueFormat ?? 'number'

  const categories = series?.data.map((d) => d.label) ?? []
  // Multi-series → one Highcharts series per data series.
  const seriesConfig = (opts.stacked && allSeries.length > 1
    ? allSeries
    : (series ? [series] : [])
  ).map((s, i) => ({
    type: opts.variant,
    name: s.name,
    color: palette[i % palette.length],
    data: s.data.map((d) => d.value),
  }))

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: opts.variant, backgroundColor: 'transparent' },
    legend: {
      enabled: showLegend,
      align: legendPos === 'left' || legendPos === 'right' ? legendPos : 'center',
      verticalAlign: legendPos === 'top' || legendPos === 'bottom' ? legendPos : 'middle',
      layout: legendPos === 'left' || legendPos === 'right' ? 'vertical' : 'horizontal',
      itemStyle: { color: 'var(--dashjs-text)' },
    },
    xAxis: {
      categories,
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
        return `<b>${this.x}</b><br>${this.series.name ? this.series.name + ': ' : ''}${formatValue(this.y, valueFormat)}`
      },
    },
    plotOptions: {
      line:       { marker: { enabled: true, radius: 4 }, lineWidth: 2 },
      spline:     { marker: { enabled: true, radius: 4 }, lineWidth: 2 },
      area:       { marker: { enabled: true, radius: 3 }, lineWidth: 2, fillOpacity: 0.25, stacking: opts.stacked ? 'normal' : undefined },
      areaspline: { marker: { enabled: true, radius: 3 }, lineWidth: 2, fillOpacity: 0.25 },
    },
    series: seriesConfig,
  })

  return { destroy: () => hc.destroy() }
}

interface PieOptions {
  variant: 'pie' | 'donut' | 'semicircle'
}

function renderPie(el: HTMLElement, chart: DashboardChartRecord, opts: PieOptions): ChartHandle {
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
        innerSize: opts.variant === 'donut' ? '55%' : (opts.variant === 'semicircle' ? '50%' : 0),
        startAngle: opts.variant === 'semicircle' ? -90 : undefined,
        endAngle:   opts.variant === 'semicircle' ?  90 : undefined,
        center: opts.variant === 'semicircle' ? ['50%', '75%'] : undefined,
        // Labels inside slices (just the percent); slice names live in
        // the legend. External connector labels don't fit small cards.
        dataLabels: {
          enabled: labels.showValues ?? true,
          distance: '-25%',
          crop: false,
          formatter: function (this: any) {
            const pct = (this.y / total) * 100
            // Hide labels on tiny slices to avoid overlap.
            if (pct < 6) return ''
            return valueFormat === 'percent'
              ? `${pct.toFixed(0)}%`
              : `${this.y}`
          },
          style: {
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: '600',
            textOutline: '1px rgba(0,0,0,0.4)',
          },
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

// --- Phase H+ chart renderers -----------------------------------------

function renderLollipop(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const valueFormat = labels.valueFormat ?? 'number'

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: 'lollipop', backgroundColor: 'transparent', inverted: true },
    legend: { enabled: false },
    xAxis: { type: 'category', lineColor: 'var(--dashjs-border)' },
    yAxis: { title: { text: undefined }, gridLineColor: 'var(--dashjs-border)' },
    tooltip: { pointFormatter: function (this: any) { return formatValue(this.y, valueFormat) } },
    series: [{
      type: 'lollipop',
      name: series?.name ?? '',
      color: palette[0],
      data: (series?.data ?? []).map((d) => ({ name: d.label, y: d.value })),
    }],
  })
  return { destroy: () => hc.destroy() }
}

function renderVariablePie(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const showLegend = labels.showLegend ?? true

  // Use two metrics from each datapoint: `value` drives slice angle, and a
  // synthesised `z` (here equal to value) drives slice radius. With single-
  // metric mock data both end up equal so the chart still reads as a pie.
  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: 'variablepie', backgroundColor: 'transparent' },
    legend: { enabled: showLegend, itemStyle: { color: 'var(--dashjs-text)' } },
    series: [{
      type: 'variablepie',
      minPointSize: 30,
      zMin: 0,
      colors: palette,
      data: (series?.data ?? []).map((d) => ({ name: d.label, y: d.value, z: d.value })),
    }],
  })
  return { destroy: () => hc.destroy() }
}

function renderScatter(el: HTMLElement, chart: DashboardChartRecord, opts: { bubble: boolean }): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const valueFormat = labels.valueFormat ?? 'number'

  // ChartDataPoint has {label, value}. For scatter/bubble we need (x, y[, z]).
  // Derive x from the index so the chart renders something sensible from the
  // existing mock shape; real data integration (Phase F) will supply x/y.
  const data = (series?.data ?? []).map((d, i) => opts.bubble
    ? [i, d.value, d.value]
    : [i, d.value]
  )

  const hcType = opts.bubble ? 'bubble' : 'scatter'

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: hcType, backgroundColor: 'transparent' },
    legend: { enabled: false },
    xAxis: { gridLineWidth: 1, gridLineColor: 'var(--dashjs-border)' },
    yAxis: { title: { text: undefined }, gridLineColor: 'var(--dashjs-border)' },
    tooltip: {
      pointFormatter: function (this: any) {
        return `<b>${series?.data[this.x]?.label ?? ''}</b><br>${formatValue(this.y, valueFormat)}`
      },
    },
    series: [{ type: hcType, name: series?.name ?? '', color: palette[0], data }],
  })
  return { destroy: () => hc.destroy() }
}

function renderTreemap(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { backgroundColor: 'transparent' },
    legend: { enabled: false },
    colorAxis: { minColor: palette[0], maxColor: palette[2] ?? palette[0] },
    series: [{
      type: 'treemap',
      layoutAlgorithm: 'squarified',
      data: (series?.data ?? []).map((d) => ({ name: d.label, value: d.value })),
      dataLabels: { enabled: true, style: { textOutline: 'none', color: '#fff', fontWeight: '500' } },
    }],
  })
  return { destroy: () => hc.destroy() }
}

function renderHeatmap(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)

  // Synthesise a 5×days grid from the existing 1D data so the heatmap looks
  // realistic against mock data. Phase F supplies real 2D data.
  const cols = Math.min(7, series?.data.length ?? 0) || 5
  const rows = 5
  const data: [number, number, number][] = []
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const baseVal = series?.data[x]?.value ?? 0
      data.push([x, y, Math.round(baseVal * (0.5 + (y / rows) * 0.5))])
    }
  }

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: 'heatmap', backgroundColor: 'transparent' },
    legend: { enabled: false },
    xAxis: { categories: (series?.data ?? []).slice(0, cols).map((d) => d.label) },
    yAxis: { title: { text: undefined }, categories: ['L1', 'L2', 'L3', 'L4', 'L5'] },
    colorAxis: { minColor: '#e8f1fb', maxColor: palette[0] },
    series: [{
      type: 'heatmap',
      name: series?.name ?? '',
      borderWidth: 1,
      borderColor: 'var(--dashjs-bg)',
      data,
      dataLabels: { enabled: true, style: { textOutline: 'none', fontSize: '10px' } },
    }],
  })
  return { destroy: () => hc.destroy() }
}

function renderSunburst(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)

  // Sunburst wants a flat list with parent pointers. Synthesise a single
  // root from the existing 1D data so something renders meaningfully.
  const data: { id: string; parent?: string; name: string; value?: number }[] = [
    { id: 'root', name: chart.dashboard_chart_title ?? 'Root' },
    ...(series?.data ?? []).map((d, i) => ({
      id: `n${i}`,
      parent: 'root',
      name: d.label,
      value: d.value,
    })),
  ]

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { backgroundColor: 'transparent' },
    legend: { enabled: false },
    series: [{
      type: 'sunburst',
      data,
      allowTraversingTree: true,
      colors: palette,
      levels: [
        { level: 1, colorByPoint: true },
        { level: 2, colorVariation: { key: 'brightness', to: -0.3 } },
      ],
    }],
  })
  return { destroy: () => hc.destroy() }
}

function renderFunnelLike(el: HTMLElement, chart: DashboardChartRecord, hcType: 'funnel' | 'pyramid'): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const showLegend = labels.showLegend ?? false

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: hcType, backgroundColor: 'transparent' },
    legend: { enabled: showLegend, itemStyle: { color: 'var(--dashjs-text)' } },
    plotOptions: {
      [hcType]: {
        colors: palette,
        dataLabels: { enabled: true, softConnector: true, style: { color: 'var(--dashjs-text)', textOutline: 'none' } },
        center: ['40%', '50%'],
        width: '70%',
      },
    } as any,
    series: [{
      type: hcType,
      name: series?.name ?? '',
      data: (series?.data ?? []).map((d) => [d.label, d.value]),
    }],
  })
  return { destroy: () => hc.destroy() }
}

function renderSankey(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)

  // Synthesise links: each category contributes to a single "Total" sink so
  // the diagram is visually meaningful against single-series mock data.
  const data = (series?.data ?? []).map((d) => [d.label, 'Total', d.value])

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { backgroundColor: 'transparent' },
    legend: { enabled: false },
    series: [{
      type: 'sankey',
      name: series?.name ?? '',
      keys: ['from', 'to', 'weight'],
      data,
      colors: palette,
    }],
  })
  return { destroy: () => hc.destroy() }
}

function renderTimeline(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: 'timeline', backgroundColor: 'transparent' },
    colors: palette,
    legend: { enabled: false },
    xAxis: { visible: false },
    yAxis: { visible: false },
    series: [{
      type: 'timeline',
      name: series?.name ?? '',
      data: (series?.data ?? []).map((d) => ({ name: d.label, label: d.label, description: String(d.value) })),
    }],
  })
  return { destroy: () => hc.destroy() }
}

function renderWordcloud(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { backgroundColor: 'transparent' },
    legend: { enabled: false },
    series: [{
      type: 'wordcloud',
      data: (series?.data ?? []).map((d) => ({ name: d.label, weight: d.value })),
      colors: palette,
      rotation: { from: 0, to: 0, orientations: 1 },
    }],
  })
  return { destroy: () => hc.destroy() }
}

function renderGauge(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const valueFormat = labels.valueFormat ?? 'number'
  // For gauge we use the chart-level kpi_value if present, else first data point.
  const value = chart.kpi_value ?? firstSeries(chart)?.data[0]?.value ?? 0
  // Choose a sensible 0..max range. With a typical 0–100 metric we just use 100.
  const max = Math.max(100, value * 1.2)

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: 'solidgauge', backgroundColor: 'transparent' },
    pane: {
      startAngle: -120,
      endAngle: 120,
      background: [{ outerRadius: '100%', innerRadius: '78%', backgroundColor: 'var(--dashjs-bg-subtle)', borderWidth: 0 }],
    },
    yAxis: {
      min: 0,
      max,
      lineWidth: 0,
      tickPositions: [],
      labels: { enabled: false },
    },
    plotOptions: {
      solidgauge: {
        innerRadius: '78%',
        dataLabels: {
          y: -20,
          borderWidth: 0,
          useHTML: true,
          format: `<div style="text-align:center;font-size:24px;font-weight:700;color:var(--dashjs-text)">{y}</div>`,
        },
      },
    },
    series: [{
      type: 'solidgauge',
      data: [{ y: typeof value === 'number' ? Number(formatValue(value, valueFormat).replace(/[^\d.-]/g, '')) || value : value, color: palette[0] }],
    }],
  })
  return { destroy: () => hc.destroy() }
}

function renderWaterfall(el: HTMLElement, chart: DashboardChartRecord): ChartHandle {
  const series = firstSeries(chart)
  const palette = paletteFor(chart.dashboard_chart_config)
  const labels = chart.dashboard_chart_config?.labels ?? {}
  const valueFormat = labels.valueFormat ?? 'number'

  const hc = Highcharts.chart(el, {
    ...commonOptions(chart),
    chart: { type: 'waterfall', backgroundColor: 'transparent' },
    legend: { enabled: false },
    xAxis: { type: 'category', lineColor: 'var(--dashjs-border)' },
    yAxis: { title: { text: undefined }, gridLineColor: 'var(--dashjs-border)' },
    tooltip: { pointFormatter: function (this: any) { return formatValue(this.y, valueFormat) } },
    series: [{
      type: 'waterfall',
      name: series?.name ?? '',
      upColor: palette[4] ?? '#448361',
      color: palette[2] ?? '#d44c47',
      data: (series?.data ?? []).map((d) => ({ name: d.label, y: d.value })),
    }],
  })
  return { destroy: () => hc.destroy() }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
