// DashboardEditor — Looker-Studio-inspired editor.
// Phase A: charts render from a real dashboard data structure, selection
// model, Properties panel populates with selected chart's config, edits
// re-render the chart live.

import { GridStack, type GridItemHTMLElement, type GridStackNode } from 'gridstack'
import type { DashboardFull, DashboardChartRecord, ChartType, AggregationMode, DashboardPageRecord, DashboardFilter, FilterOperator, ChartConfig } from '../domain'
import type { DashJsDataSource, DataField } from '../types'
import { renderChart, type ChartHandle } from '../charts/renderChart'
import { createDefaultChart } from '../charts/defaults'
import { applyFilters } from '../charts/applyFilters'
import { DEFAULT_PALETTE, paletteFor } from '../charts/palette'
import { parseCsv } from '../charts/csv'
import { CHART_TYPE_SCHEMAS, readSlot, type SlotSpec } from '../charts/slots'
import { icon } from '../icons'
import { MOCK_FIELDS, fieldTypeBadge } from '../mockData'

const GRID_COLUMNS = 12
/** Pixel height of one grid row. Determines chart heights together with `h`. */
const GRID_ROW_HEIGHT = 60

export interface DashboardEditorContext {
  dashboard: DashboardFull
  dictionary?: Record<string, string>
  onSave?: (dashboard: DashboardFull) => void | Promise<void>
  dataSource?: DashJsDataSource
}

type PanelKey = 'data' | 'properties'
interface PanelState { data: boolean; properties: boolean }

const CHART_TYPE_OPTIONS: { type: ChartType; label: string; iconKey: string }[] = [
  // Bar family
  { type: 'bar',                   label: 'Bar',          iconKey: 'chart-bar' },
  { type: 'horizontalBar',         label: 'H. bar',       iconKey: 'chart-bar-horizontal' },
  { type: 'stackedBar',            label: 'Stacked',      iconKey: 'chart-bar-stacked' },
  { type: 'stackedBarPercent',     label: '100% stack',   iconKey: 'chart-bar-stacked' },
  { type: 'stackedHorizontalBar',  label: 'H. stacked',   iconKey: 'chart-bar-stacked-horizontal' },
  { type: 'lollipop',              label: 'Lollipop',     iconKey: 'chart-scatter' },
  // Line family
  { type: 'line',                  label: 'Line',         iconKey: 'chart-line' },
  { type: 'spline',                label: 'Spline',       iconKey: 'chart-line' },
  { type: 'area',                  label: 'Area',         iconKey: 'chart-area' },
  { type: 'areaSpline',            label: 'Area spline',  iconKey: 'chart-area' },
  { type: 'stackedArea',           label: 'Stacked area', iconKey: 'chart-layers' },
  // Pie family
  { type: 'pie',                   label: 'Pie',          iconKey: 'chart-pie' },
  { type: 'donut',                 label: 'Donut',        iconKey: 'chart-donut' },
  { type: 'semicircle',            label: 'Semicircle',   iconKey: 'chart-pie' },
  { type: 'variablePie',           label: 'Var. pie',     iconKey: 'chart-pie' },
  // Scatter family
  { type: 'scatter',               label: 'Scatter',      iconKey: 'chart-scatter' },
  { type: 'bubble',                label: 'Bubble',       iconKey: 'chart-bubble' },
  // Hierarchy / matrix
  { type: 'treemap',               label: 'Treemap',      iconKey: 'chart-treemap' },
  { type: 'heatmap',               label: 'Heatmap',      iconKey: 'chart-heatmap' },
  { type: 'sunburst',              label: 'Sunburst',     iconKey: 'chart-sunburst' },
  // Flow / specialty
  { type: 'funnel',                label: 'Funnel',       iconKey: 'chart-funnel' },
  { type: 'pyramid',               label: 'Pyramid',      iconKey: 'chart-pyramid' },
  { type: 'sankey',                label: 'Sankey',       iconKey: 'chart-sankey' },
  { type: 'timeline',              label: 'Timeline',     iconKey: 'chart-timeline' },
  { type: 'wordcloud',             label: 'Wordcloud',    iconKey: 'chart-wordcloud' },
  { type: 'gauge',                 label: 'Gauge',        iconKey: 'chart-gauge' },
  { type: 'waterfall',             label: 'Waterfall',    iconKey: 'chart-waterfall' },
  // Display
  { type: 'kpi',                   label: 'KPI',          iconKey: 'chart-kpi' },
  { type: 'table',                 label: 'Table',        iconKey: 'chart-table' },
]

const AGGREGATION_OPTIONS: { value: AggregationMode; label: string }[] = [
  { value: 'count',      label: 'Count' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'mean',       label: 'Mean' },
  { value: 'sum',        label: 'Sum' },
]

/** Short uppercase labels shown inline on metric chips (Looker convention). */
const AGG_SHORT_LABEL: Record<AggregationMode, string> = {
  count:      'CNT',
  percentage: '%',
  sum:        'SUM',
  mean:       'AVG',
}

const VALUE_FORMAT_OPTIONS: { value: NonNullable<NonNullable<ChartConfig['labels']>['valueFormat']>; label: string }[] = [
  { value: 'number',   label: 'Number' },
  { value: 'percent',  label: 'Percent' },
  { value: 'decimal1', label: '1 decimal' },
  { value: 'decimal2', label: '2 decimals' },
]

const LEGEND_POSITION_OPTIONS: { value: NonNullable<NonNullable<ChartConfig['labels']>['legendPosition']>; label: string }[] = [
  { value: 'top',    label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left',   label: 'Left' },
  { value: 'right',  label: 'Right' },
]

type PropTab = 'setup' | 'style'

export class DashboardEditor {
  private root: HTMLElement
  private ctx: DashboardEditorContext
  private dashboard: DashboardFull
  private chartHandles = new Map<number, ChartHandle>()
  private selectedChartId: number | null = null
  private activePageId: number
  private grid: GridStack | null = null
  private panels: PanelState = { data: false, properties: false }
  private fieldQuery = ''
  private addChartOpen = false
  private isDirty = false
  private isSaving = false
  private savedFlashTimer: number | null = null
  private activePropTab: PropTab = 'setup'
  /** Field catalogue — sourced from ctx.dataSource.listFields() when present,
   *  else MOCK_FIELDS. Updated asynchronously after construction. */
  private fields: DataField[] = []
  /** Per-chart fetch tokens so stale getChartData responses can't overwrite
   *  a newer render after the user changes the chart's config quickly. */
  private chartFetchTokens = new Map<number, number>()
  /** Uploaded CSV — when present, replaces both the field catalogue and the
   *  source of chart data. Aggregations are computed client-side from the
   *  rows on every (re)render. */
  private csvData: { rows: Record<string, string>[]; fileName: string } | null = null
  /** Bound listener so we can remove it cleanly when the popover closes. */
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null
  private escKeyHandler: ((e: KeyboardEvent) => void) | null = null

  constructor(root: HTMLElement, ctx: DashboardEditorContext) {
    this.root = root
    this.ctx = ctx
    // Deep-clone so edits don't mutate the caller's reference.
    this.dashboard = JSON.parse(JSON.stringify(ctx.dashboard))
    // Make sure there's at least one page; pick the first as active.
    if (this.dashboard.pages.length === 0) {
      this.dashboard.pages.push({
        dashboard_page_id: 1,
        dashboard_page_name: 'Page 1',
        charts: [],
      })
    }
    this.activePageId = this.dashboard.pages[0].dashboard_page_id
    // Seed fields synchronously with the mock so the first render has
    // something to show; if a dataSource is provided, refresh once the
    // host promise resolves and re-render the affected surfaces.
    this.fields = MOCK_FIELDS
  }

  render(): void {
    const t = (key: string, fallback: string) => this.ctx.dictionary?.[key] ?? fallback
    const d = this.dashboard

    this.root.innerHTML = `
      <div class="dashjs-editor">
        ${this.renderMenuBar()}
        ${this.renderToolbar(t)}
        ${this.renderFilterBar(t)}
        <div class="dashjs-editor__body" data-panel="${this.panelStateAttr()}">
          <div class="dashjs-editor__main">
            <div class="dashjs-editor__canvas" data-canvas>
              ${this.renderCanvasContent()}
            </div>
            <div class="dashjs-editor__pagefoot" data-page-foot>
              ${this.renderPageTabs()}
            </div>
          </div>
          <aside class="dashjs-editor__panel dashjs-editor__panel--properties" data-panel-host="properties" aria-hidden="${!this.panels.properties}">
            ${this.panels.properties ? this.renderPropertiesPanel(t) : ''}
          </aside>
          <aside class="dashjs-editor__panel dashjs-editor__panel--data" data-panel-host="data" aria-hidden="${!this.panels.data}">
            ${this.panels.data ? this.renderDataPanel(t) : ''}
          </aside>
          <nav class="dashjs-editor__rail" aria-label="Panel manager">
            ${this.renderRailButton('data', icon('database', { size: 18 }), t('editor.data', 'Data'))}
            ${this.renderRailButton('properties', icon('pencil', { size: 18 }), t('editor.properties', 'Properties'))}
          </nav>
        </div>
      </div>
    `

    this.initGrid()
    this.mountAllCharts()
    this.attachEvents()
    this.updatePageLabel()
    // Refresh field catalogue from the data source if one is provided.
    // Runs async; we don't block the initial render.
    void this.loadFields()
  }

  /** Pull the field catalogue from the data source (when present). On
   *  success, re-render any panel that lists or selects fields so the new
   *  catalogue takes effect. Errors fall back to whatever fields are
   *  already loaded — typically MOCK_FIELDS from construction. */
  private async loadFields(): Promise<void> {
    if (!this.ctx.dataSource) return
    try {
      const fields = await this.ctx.dataSource.listFields()
      this.fields = fields
      // Re-render the Data panel + Properties dropdowns to reflect the new fields.
      this.refreshPanels()
    } catch (err) {
      console.error('[dashjs] listFields failed', err)
    }
  }

  destroy(): void {
    this.closeAddChartPopover()
    this.closeFilterPopover()
    if (this.savedFlashTimer) {
      window.clearTimeout(this.savedFlashTimer)
      this.savedFlashTimer = null
    }
    this.disposeGrid()
    this.disposeCharts()
    this.root.innerHTML = ''
  }

  // --- chrome renderers (unchanged from before) ---

  private renderMenuBar(): string {
    const items = ['File', 'Edit', 'View', 'Insert', 'Page', 'Arrange', 'Resource', 'Help']
    return `
      <div class="dashjs-editor__menubar">
        ${items.map((label) => `<button class="dashjs-editor__menubtn" disabled>${label}</button>`).join('')}
      </div>
    `
  }

  private renderToolbar(t: (k: string, f: string) => string): string {
    const sep = `<span class="dashjs-editor__sep" aria-hidden="true"></span>`
    const btn = (id: string, ic: string, label: string, opts: { primary?: boolean; iconOnly?: boolean; dropdown?: boolean } = {}) => {
      const cls = ['dashjs-editor__tbbtn']
      if (opts.iconOnly) cls.push('dashjs-editor__tbbtn--icon')
      if (opts.primary) cls.push('dashjs-editor__tbbtn--primary')
      const caret = opts.dropdown ? icon('chevron-down', { size: 12 }) : ''
      const text = opts.iconOnly ? `<span class="dashjs-sr">${label}</span>` : `<span>${label}</span>`
      return `<button class="${cls.join(' ')}" data-tb="${id}" title="${label}">${ic}${text}${caret}</button>`
    }

    return `
      <div class="dashjs-editor__toolbar" data-toolbar>
        ${btn('undo', icon('undo', { size: 16 }), t('editor.undo', 'Undo'), { iconOnly: true })}
        ${btn('redo', icon('redo', { size: 16 }), t('editor.redo', 'Redo'), { iconOnly: true })}
        ${sep}
        ${btn('cursor', icon('cursor', { size: 16 }), t('editor.cursor', 'Select'), { iconOnly: true })}
        ${btn('zoom', `<span>100%</span>`, t('editor.zoom', 'Zoom'), { dropdown: true })}
        ${sep}
        ${btn('prev', icon('chevron-left', { size: 16 }), t('editor.prevPage', 'Previous page'), { iconOnly: true })}
        <span class="dashjs-editor__pagelabel">${t('editor.pageOf', 'Page')} 1 / 1</span>
        ${btn('next', icon('chevron-right', { size: 16 }), t('editor.nextPage', 'Next page'), { iconOnly: true })}
        ${sep}
        ${btn('add-data', icon('database', { size: 16 }), t('editor.addData', 'Add data'))}
        ${btn('blend', icon('shapes', { size: 16 }), t('editor.blend', 'Blend'))}
        ${btn('add-chart', icon('chart', { size: 16 }), t('editor.addChart', 'Add a chart'), { dropdown: true })}
        ${btn('add-control', icon('filter', { size: 16 }), t('editor.addControl', 'Add a control'), { dropdown: true })}
        ${sep}
        ${btn('html', icon('code', { size: 16 }), t('editor.html', 'HTML'), { iconOnly: true, dropdown: true })}
        ${btn('image', icon('image', { size: 16 }), t('editor.image', 'Image'), { iconOnly: true, dropdown: true })}
        ${btn('text', icon('text', { size: 16 }), t('editor.text', 'Text'), { iconOnly: true })}
        ${btn('line', icon('line', { size: 16 }), t('editor.line', 'Line'), { iconOnly: true, dropdown: true })}
        ${btn('shape', icon('shapes', { size: 16 }), t('editor.shape', 'Shape'), { iconOnly: true, dropdown: true })}
        <span class="dashjs-editor__spacer"></span>
        ${btn('theme', icon('palette', { size: 16 }), t('editor.theme', 'Theme and layout'))}
        ${this.renderSaveButton(t)}
      </div>
    `
  }

  private renderSaveButton(t: (k: string, f: string) => string): string {
    const label = this.isSaving
      ? t('editor.saving', 'Saving…')
      : t('editor.save', 'Save')
    const disabled = this.isSaving || !this.isDirty ? 'disabled' : ''
    return `
      <button
        class="dashjs-editor__tbbtn dashjs-editor__tbbtn--primary"
        data-tb="save"
        ${disabled}
        title="${t('editor.save', 'Save')}"
      >
        ${icon('save', { size: 16 })}
        <span data-save-label>${label}</span>
      </button>
    `
  }

  private renderFilterBar(t: (k: string, f: string) => string): string {
    const filters = this.dashboard.filters ?? []
    const chips = filters.map((f) => `
      <button class="dashjs-editor__chip" data-filter-chip="${f.id}" title="${escape(this.filterTooltip(f))}">
        ${icon('filter', { size: 14 })}
        <span>${escape(this.filterChipLabel(f))}</span>
        <span class="dashjs-editor__chip-x" data-filter-remove="${f.id}" aria-label="Remove filter">
          ${icon('x', { size: 12 })}
        </span>
      </button>
    `).join('')

    return `
      <div class="dashjs-editor__filterbar">
        <button class="dashjs-editor__chip dashjs-editor__chip--add" data-tb="add-filter">
          ${icon('filter', { size: 14 })}
          <span>${t('editor.addFilter', 'Add filter')}</span>
        </button>
        ${chips}
        <span class="dashjs-editor__spacer"></span>
        ${filters.length > 0 ? `
          <button class="dashjs-editor__chip dashjs-editor__chip--ghost" data-tb="reset">
            ${icon('reset', { size: 14 })}
            <span>${t('editor.reset', 'Reset')}</span>
          </button>
        ` : ''}
      </div>
    `
  }

  private filterChipLabel(f: DashboardFilter): string {
    const op = f.operator === 'in' ? '∈' : f.operator === 'not_in' ? '∉' : f.operator === 'eq' ? '=' : '≠'
    const vals = f.values.length > 2 ? `${f.values.slice(0, 2).join(', ')} +${f.values.length - 2}` : f.values.join(', ')
    return `${f.fieldName} ${op} ${vals}`
  }

  private filterTooltip(f: DashboardFilter): string {
    return `${f.fieldName} ${f.operator} [${f.values.join(', ')}]`
  }

  private renderRailButton(key: PanelKey, ic: string, label: string): string {
    const active = this.panels[key] ? 'is-active' : ''
    return `
      <button class="dashjs-editor__railbtn ${active}" data-rail="${key}" title="${label}">
        ${ic}
        <span class="dashjs-editor__raillabel">${label}</span>
      </button>
    `
  }

  private panelStateAttr(): string {
    if (this.panels.data && this.panels.properties) return 'both'
    if (this.panels.data) return 'data'
    if (this.panels.properties) return 'properties'
    return 'none'
  }

  // --- canvas ---

  private activePage(): DashboardPageRecord {
    const found = this.dashboard.pages.find((p) => p.dashboard_page_id === this.activePageId)
    return found ?? this.dashboard.pages[0]
  }

  private renderCanvasContent(): string {
    const page = this.activePage()
    return `
      <div class="dashjs-canvas__inner">
        <div class="dashjs-canvas__header">
          <h1 class="dashjs-canvas__title">${escape(this.dashboard.dashboard_name)}</h1>
          <div class="dashjs-canvas__subtitle">
            ${this.dashboard.survey_name ? escape(this.dashboard.survey_name) + ' · ' : ''}${this.dashboard.dashboard_updated ?? ''}
          </div>
        </div>
        <div class="grid-stack" data-grid-root>
          ${(page.charts ?? []).map((c) => this.renderChartCard(c)).join('')}
        </div>
      </div>
    `
  }

  private renderChartCard(c: DashboardChartRecord): string {
    const w = c.dashboard_chart_w ?? 6
    const h = c.dashboard_chart_h ?? 4
    const x = c.dashboard_chart_x ?? 0
    const y = c.dashboard_chart_y ?? 0
    const selected = this.selectedChartId === c.dashboard_chart_id ? 'is-selected' : ''
    // Gridstack reads gs-x/y/w/h attributes on .grid-stack-item children.
    return `
      <div
        class="grid-stack-item dashjs-card dashjs-card--chart ${selected}"
        data-chart-id="${c.dashboard_chart_id}"
        gs-x="${x}" gs-y="${y}" gs-w="${w}" gs-h="${h}"
      >
        <div class="grid-stack-item-content dashjs-card__inner">
          <div class="dashjs-card__title">${escape(c.dashboard_chart_title ?? 'Untitled')}</div>
          <div class="dashjs-card__body" data-chart-body></div>
        </div>
      </div>
    `
  }

  private renderPageTabs(): string {
    const tabs = this.dashboard.pages.map((p) => {
      const active = p.dashboard_page_id === this.activePageId ? 'is-active' : ''
      return `
        <button class="dashjs-pagetab ${active}" data-page-tab="${p.dashboard_page_id}">
          ${escape(p.dashboard_page_name)}
        </button>
      `
    }).join('')
    return `
      <div class="dashjs-pagetabs">
        ${tabs}
        <button class="dashjs-pagetab dashjs-pagetab--add" data-page-add title="Add page">
          ${icon('plus', { size: 14 })}
        </button>
      </div>
    `
  }

  // --- panel content ---

  private renderDataPanel(t: (k: string, f: string) => string): string {
    const fields = this.filteredFields()
    const sourceLabel = this.csvData
      ? `${escape(this.csvData.fileName)} · ${this.csvData.rows.length} rows`
      : escape(this.dashboard.survey_name ?? 'Mock data')
    return `
      <div class="dashjs-panel">
        <div class="dashjs-panel__header">
          ${icon('database', { size: 16 })}
          <span class="dashjs-panel__title">${t('editor.data', 'Data')}</span>
        </div>
        <div class="dashjs-panel__search">
          ${icon('search', { size: 14 })}
          <input
            class="dashjs-panel__searchinput"
            data-field-search
            type="text"
            placeholder="${t('editor.searchFields', 'Search')}"
            value="${this.fieldQuery.replace(/"/g, '&quot;')}"
          />
        </div>
        <div class="dashjs-panel__source">
          <div class="dashjs-panel__sourceicon">${icon('chart', { size: 14 })}</div>
          <span class="dashjs-panel__sourcelabel">${sourceLabel}</span>
        </div>
        <ul class="dashjs-fieldlist">
          ${fields.map(this.renderField).join('')}
        </ul>
      </div>
    `
  }

  private renderField = (f: DataField): string => {
    const badge = fieldTypeBadge(f.type)
    return `
      <li class="dashjs-field" data-field="${f.id}" draggable="true">
        <span class="dashjs-field__badge" style="color:${badge.color}">${badge.label}</span>
        <span class="dashjs-field__name">${escape(f.name)}</span>
      </li>
    `
  }

  private renderPropertiesPanel(t: (k: string, f: string) => string): string {
    const chart = this.selectedChart()
    if (!chart) {
      return `
        <div class="dashjs-panel">
          <div class="dashjs-panel__header">
            ${icon('pencil', { size: 16 })}
            <span class="dashjs-panel__title">${t('editor.properties', 'Properties')}</span>
          </div>
          <div class="dashjs-panel__empty">
            ${t('editor.propertiesEmpty', 'Select a chart on the canvas to configure its properties.')}
          </div>
          <div class="dashjs-props__addchart">
            <div class="dashjs-props__addchart-title">${t('editor.addChart', 'Add a chart')}</div>
            ${this.renderAddChartTiles()}
          </div>
        </div>
      `
    }
    return this.renderPropertiesForChart(chart, t)
  }

  /** Tile grid shared by the toolbar "Add a chart" popover and the
   *  Properties-panel empty state. Each tile carries `data-add-type` so a
   *  single click handler (bound in attachPropertyEvents / openAddChartPopover)
   *  can dispatch to `addChart(type)`. */
  private renderAddChartTiles(): string {
    return `
      <div class="dashjs-typegrid">
        ${CHART_TYPE_OPTIONS.map((tile) => `
          <button class="dashjs-typetile" data-add-type="${tile.type}" title="${tile.label}">
            <span class="dashjs-typetile__icon">${icon(tile.iconKey as any, { size: 18 })}</span>
            <span class="dashjs-typetile__label">${tile.label}</span>
          </button>
        `).join('')}
      </div>
    `
  }

  private renderPropertiesForChart(chart: DashboardChartRecord, t: (k: string, f: string) => string): string {
    const body = this.activePropTab === 'style'
      ? this.renderStyleTab(chart, t)
      : this.renderSetupTab(chart, t)

    return `
      <div class="dashjs-panel">
        <div class="dashjs-panel__header">
          ${icon('pencil', { size: 16 })}
          <span class="dashjs-panel__title">${t('editor.properties', 'Properties')}</span>
        </div>
        <div class="dashjs-tabs">
          <button class="dashjs-tabs__btn ${this.activePropTab === 'setup' ? 'is-active' : ''}" data-prop-tab="setup">
            ${t('editor.tabSetup', 'Setup')}
          </button>
          <button class="dashjs-tabs__btn ${this.activePropTab === 'style' ? 'is-active' : ''}" data-prop-tab="style">
            ${t('editor.tabStyle', 'Style')}
          </button>
        </div>
        <div class="dashjs-props">
          ${body}
        </div>
      </div>
    `
  }

  private renderSetupTab(chart: DashboardChartRecord, t: (k: string, f: string) => string): string {
    const cfg = chart.dashboard_chart_config ?? {}

    const typeOptions = CHART_TYPE_OPTIONS.map((o) => `
      <button
        class="dashjs-typetile ${o.type === chart.dashboard_chart_type ? 'is-active' : ''}"
        data-prop="type"
        data-value="${o.type}"
        title="${o.label}"
      >
        <span class="dashjs-typetile__icon">${icon(o.iconKey as any, { size: 18 })}</span>
        <span class="dashjs-typetile__label">${o.label}</span>
      </button>
    `).join('')

    const schema = CHART_TYPE_SCHEMAS[chart.dashboard_chart_type]
    const slotSections = schema.slots.map((slot) => this.renderSlotChip(slot, cfg)).join('')

    return `
      <div class="dashjs-props__section">
        <label class="dashjs-props__label">${t('editor.title', 'Title')}</label>
        <input
          class="dashjs-form__input"
          type="text"
          data-prop="title"
          value="${escape(chart.dashboard_chart_title ?? '')}"
        />
      </div>

      <div class="dashjs-props__section">
        <label class="dashjs-props__label">${t('editor.chartType', 'Chart type')}</label>
        <div class="dashjs-typegrid">${typeOptions}</div>
      </div>

      ${slotSections}

      <div class="dashjs-props__section">
        <label class="dashjs-props__label">${t('editor.filters', 'Filters')}</label>
        <div class="dashjs-props__chiplist">
          ${(cfg.filters ?? []).map((f) => `
            <div class="dashjs-editor__chip dashjs-editor__chip--inline" title="${escape(this.filterTooltip(f))}">
              ${icon('filter', { size: 12 })}
              <span>${escape(this.filterChipLabel(f))}</span>
              <span class="dashjs-editor__chip-x" data-chart-filter-remove="${f.id}" aria-label="Remove filter">
                ${icon('x', { size: 10 })}
              </span>
            </div>
          `).join('')}
        </div>
        <button class="dashjs-btn" data-action="add-chart-filter">
          ${icon('plus', { size: 12 })}
          <span>${t('editor.addChartFilter', 'Add filter')}</span>
        </button>
      </div>

      <div class="dashjs-props__section">
        <button class="dashjs-btn dashjs-btn--danger" data-action="delete-chart">
          ${icon('trash', { size: 14 })}
          <span>${t('editor.deleteChart', 'Delete chart')}</span>
        </button>
      </div>
    `
  }

  /** Render one slot from the chart-type schema as a Looker-style chip.
   *
   *  Dimension chip: `[ TYPE-BADGE | field-name | × ]` — green tint, badge
   *  shows the field's data type glyph (ABC / 123 / 📅 / …). Empty slot
   *  renders as a dashed "+ Add …" pill.
   *
   *  Metric chip: `[ AGG-BADGE | field-name | × ]` — blue tint, badge shows
   *  the aggregation in uppercase (SUM / AVG / CT / %). When no field is
   *  bound the chip defaults to "Record Count" (a virtual metric — `count`
   *  with no fieldId). Metric chips never have an "empty" state.
   *
   *  All click targets carry `data-chip-action` so attachChipEvents can
   *  route to openSlotFieldPicker / openSlotAggPicker / clearSlot.
   */
  private renderSlotChip(slot: SlotSpec, cfg: any): string {
    const value = readSlot(cfg, slot.id)
    const field = value.fieldId ? this.fields.find((f) => f.id === value.fieldId) : undefined

    if (slot.kind === 'dimension') {
      if (!field) {
        return `
          <div class="dashjs-props__section">
            <label class="dashjs-props__label">${escape(slot.label)}</label>
            <button class="dashjs-chip dashjs-chip--empty dashjs-chip--dim"
                    data-chip-slot="${slot.id}" data-chip-kind="dimension"
                    data-chip-action="open-field">
              ${icon('plus', { size: 12 })}
              <span>Add ${escape(slot.label.toLowerCase())}</span>
            </button>
          </div>
        `
      }
      const badge = fieldTypeBadge(field.type)
      return `
        <div class="dashjs-props__section">
          <label class="dashjs-props__label">${escape(slot.label)}</label>
          <div class="dashjs-chip dashjs-chip--dim"
               data-chip-slot="${slot.id}" data-chip-kind="dimension">
            <span class="dashjs-chip__badge dashjs-chip__badge--dim" style="background:${badge.color}">${badge.label}</span>
            <button class="dashjs-chip__name" data-chip-action="open-field" title="${escape(field.name)}">${escape(field.name)}</button>
            <button class="dashjs-chip__x" data-chip-action="remove" aria-label="Remove">${icon('x', { size: 10 })}</button>
          </div>
        </div>
      `
    }

    // Metric slot — always shows a chip. No field bound = Record Count.
    const agg = value.aggregation ?? 'count'
    const aggLabel = AGG_SHORT_LABEL[agg]
    const isRecordCount = !field
    const displayName = isRecordCount ? 'Record Count' : (field?.name ?? '')
    return `
      <div class="dashjs-props__section">
        <label class="dashjs-props__label">${escape(slot.label)}</label>
        <div class="dashjs-chip dashjs-chip--metric"
             data-chip-slot="${slot.id}" data-chip-kind="metric">
          <button class="dashjs-chip__badge dashjs-chip__badge--metric" data-chip-action="open-agg" title="Aggregation">${aggLabel}</button>
          <button class="dashjs-chip__name" data-chip-action="open-field" title="${escape(displayName)}">${escape(displayName)}</button>
          <button class="dashjs-chip__x" data-chip-action="remove" aria-label="Reset">${icon('x', { size: 10 })}</button>
        </div>
      </div>
    `
  }

  private renderStyleTab(chart: DashboardChartRecord, t: (k: string, f: string) => string): string {
    const type = chart.dashboard_chart_type
    if (type === 'table') {
      return `
        <div class="dashjs-panel__empty">
          ${t('editor.styleTableEmpty', 'No style options for table charts yet.')}
        </div>
      `
    }

    // Group chart types so the style controls map cleanly. Anything not
    // matched here falls through with default behaviour (palette + labels +
    // legend + value format), which is fine for treemap/heatmap/sankey/etc.
    const isPieLike = type === 'pie' || type === 'donut' || type === 'semicircle' || type === 'variablePie'
    const isLineLike = type === 'line' || type === 'spline' || type === 'area' || type === 'areaSpline' || type === 'stackedArea'
    const isBarLike = type === 'bar' || type === 'horizontalBar'
      || type === 'stackedBar' || type === 'stackedBarPercent' || type === 'stackedHorizontalBar'
      || type === 'lollipop' || type === 'waterfall'
    // Gauge takes only the value format.
    const isGauge = type === 'gauge'
    // Speciality charts get the palette controls but skip the legend/values toggles.
    const isSpeciality = type === 'treemap' || type === 'heatmap' || type === 'sunburst'
      || type === 'funnel' || type === 'pyramid' || type === 'sankey' || type === 'timeline'
      || type === 'wordcloud' || type === 'scatter' || type === 'bubble'

    const cfg = chart.dashboard_chart_config ?? {}
    const labels = cfg.labels ?? {}
    const showValuesDefault = type === 'kpi' ? false : (isLineLike ? false : true)
    const showLegendDefault = isPieLike || isLineLike || type === 'stackedBar'
    const legendPosDefault: NonNullable<NonNullable<ChartConfig['labels']>['legendPosition']> = isPieLike ? 'right' : 'bottom'
    const valueFormatDefault: NonNullable<NonNullable<ChartConfig['labels']>['valueFormat']> = isPieLike ? 'percent' : 'number'

    const showValues = labels.showValues ?? showValuesDefault
    const showLegend = labels.showLegend ?? showLegendDefault
    const legendPos  = labels.legendPosition ?? legendPosDefault
    const valueFmt   = labels.valueFormat ?? valueFormatDefault

    const fmtOptions = VALUE_FORMAT_OPTIONS.map((o) => `
      <option value="${o.value}" ${valueFmt === o.value ? 'selected' : ''}>${o.label}</option>
    `).join('')

    const legendPosOptions = LEGEND_POSITION_OPTIONS.map((o) => `
      <option value="${o.value}" ${legendPos === o.value ? 'selected' : ''}>${o.label}</option>
    `).join('')

    // Colors section: bar-like / pie-like / speciality get the full palette;
    // line-like gets a single primary colour; KPI/gauge get none.
    let colorsSection = ''
    if (isBarLike || isPieLike || isSpeciality) {
      const palette = paletteFor(cfg)
      const swatches = palette.map((color, i) => `
        <label class="dashjs-swatch" title="${t('editor.colorSlot', 'Color')} ${i + 1}">
          <input type="color" data-style="palette" data-index="${i}" value="${color}" />
          <span class="dashjs-swatch__chip" style="background:${color}"></span>
        </label>
      `).join('')
      colorsSection = `
        <div class="dashjs-props__section">
          <label class="dashjs-props__label">${t('editor.colors', 'Colors')}</label>
          <div class="dashjs-swatches">${swatches}</div>
          <button class="dashjs-btn" data-style="reset-palette">
            ${icon('reset', { size: 12 })}
            <span>${t('editor.resetPalette', 'Reset palette')}</span>
          </button>
        </div>
      `
    } else if (isLineLike) {
      const palette = paletteFor(cfg)
      colorsSection = `
        <div class="dashjs-props__section">
          <label class="dashjs-props__label">${t('editor.color', 'Color')}</label>
          <label class="dashjs-swatch dashjs-swatch--single">
            <input type="color" data-style="palette" data-index="0" value="${palette[0]}" />
            <span class="dashjs-swatch__chip" style="background:${palette[0]}"></span>
          </label>
        </div>
      `
    }

    // Labels section: KPI / gauge only need value format; speciality charts
    // skip data-label / legend toggles since Highcharts handles them; the
    // rest get the full label + legend controls.
    const labelsSection = (type === 'kpi' || isGauge) ? `
      <div class="dashjs-props__section">
        <label class="dashjs-props__label">${t('editor.valueFormat', 'Value format')}</label>
        <select class="dashjs-form__input" data-style="valueFormat">${fmtOptions}</select>
      </div>
    ` : isSpeciality ? `
      <div class="dashjs-props__section">
        <label class="dashjs-props__label">${t('editor.valueFormat', 'Value format')}</label>
        <select class="dashjs-form__input" data-style="valueFormat">${fmtOptions}</select>
      </div>
    ` : `
      <div class="dashjs-props__section">
        <label class="dashjs-props__label">${t('editor.labels', 'Labels')}</label>
        <label class="dashjs-checkbox">
          <input type="checkbox" data-style="showValues" ${showValues ? 'checked' : ''} />
          <span>${t('editor.showValues', 'Show data labels')}</span>
        </label>
        <label class="dashjs-checkbox">
          <input type="checkbox" data-style="showLegend" ${showLegend ? 'checked' : ''} />
          <span>${t('editor.showLegend', 'Show legend')}</span>
        </label>
      </div>

      <div class="dashjs-props__section" ${showLegend ? '' : 'hidden'}>
        <label class="dashjs-props__label">${t('editor.legendPosition', 'Legend position')}</label>
        <select class="dashjs-form__input" data-style="legendPosition">${legendPosOptions}</select>
      </div>

      <div class="dashjs-props__section">
        <label class="dashjs-props__label">${t('editor.valueFormat', 'Value format')}</label>
        <select class="dashjs-form__input" data-style="valueFormat">${fmtOptions}</select>
      </div>
    `

    return `${colorsSection}${labelsSection}`
  }

  // --- behaviour ---

  private attachEvents(): void {
    // Rail buttons toggle panels.
    this.root.querySelectorAll<HTMLButtonElement>('[data-rail]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.rail as PanelKey
        this.panels[key] = !this.panels[key]
        this.refreshPanels()
      })
    })

    this.attachToolbarEvents()
    this.attachCanvasEvents()
    this.attachPageTabEvents()
    this.attachFieldSearch()
    this.attachFieldDragEvents()
    this.attachPropertyEvents()
  }

  private attachToolbarEvents(): void {
    const addChartBtn = this.root.querySelector<HTMLButtonElement>('[data-tb="add-chart"]')
    addChartBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.toggleAddChartPopover(addChartBtn)
    })

    // Page navigation arrows.
    this.root.querySelector<HTMLButtonElement>('[data-tb="prev"]')?.addEventListener('click', () => {
      this.gotoPageRelative(-1)
    })
    this.root.querySelector<HTMLButtonElement>('[data-tb="next"]')?.addEventListener('click', () => {
      this.gotoPageRelative(+1)
    })

    this.root.querySelector<HTMLButtonElement>('[data-tb="save"]')?.addEventListener('click', () => {
      this.save()
    })

    // "Add data" → CSV file picker. For now CSV is the only supported source;
    // future iterations could open a popover offering CSV / JSON / connect-API.
    this.root.querySelector<HTMLButtonElement>('[data-tb="add-data"]')?.addEventListener('click', () => {
      this.openCsvUpload()
    })

    this.attachFilterBarEvents()
  }

  /** Merge a partial slot value into the chart's config. Also mirrors the
   *  primary dimension/metric into the legacy `dimension` + `aggregation`
   *  fields so any reader that still consults them sees the same data. */
  private updateSlot(
    chart: DashboardChartRecord,
    slotId: string,
    patch: { fieldId?: string; aggregation?: AggregationMode },
  ): void {
    const cfg = (chart.dashboard_chart_config ??= {})
    const slots = (cfg.slots ??= {})
    const prev = slots[slotId] ?? {}
    const next = { ...prev, ...patch }
    // Empty fieldId on a dimension slot means "unbound" → drop the entry.
    if (next.fieldId === undefined && next.aggregation === undefined) {
      delete slots[slotId]
    } else {
      slots[slotId] = next
    }
    // Mirror to legacy fields for the primary slots.
    if (slotId === 'dimension') {
      if (next.fieldId) {
        const field = this.fields.find((f) => f.id === next.fieldId)
        if (field) {
          cfg.dimension = { questionCode: field.id, questionText: field.name, questionId: 0 }
        }
      } else {
        delete cfg.dimension
      }
    }
    if (slotId === 'metric' && next.aggregation) {
      cfg.aggregation = next.aggregation
    }
    this.markDirty()
    this.rerenderChart(chart.dashboard_chart_id)
  }

  private markDirty(): void {
    if (this.isDirty) return
    this.isDirty = true
    this.refreshSaveButton()
  }

  private refreshSaveButton(): void {
    const t = (k: string, f: string) => this.ctx.dictionary?.[k] ?? f
    const btn = this.root.querySelector<HTMLButtonElement>('[data-tb="save"]')
    if (!btn) return
    const label = btn.querySelector<HTMLElement>('[data-save-label]')
    btn.disabled = this.isSaving || !this.isDirty
    if (!label) return
    if (this.isSaving) {
      label.textContent = t('editor.saving', 'Saving…')
    } else if (this.isDirty) {
      label.textContent = t('editor.save', 'Save')
    } else {
      label.textContent = t('editor.save', 'Save')
    }
  }

  private async save(): Promise<void> {
    if (this.isSaving || !this.isDirty) return
    const cb = this.ctx.onSave
    // Deep-clone so the host can mutate safely without affecting the editor.
    const snapshot: DashboardFull = JSON.parse(JSON.stringify(this.dashboard))
    this.isSaving = true
    this.refreshSaveButton()
    try {
      await cb?.(snapshot)
      this.isDirty = false
      this.flashSaved()
    } catch (err) {
      console.error('[dashjs] onSave failed', err)
    } finally {
      this.isSaving = false
      this.refreshSaveButton()
    }
  }

  /** Briefly show a "Saved" state after a successful save. */
  private flashSaved(): void {
    const t = (k: string, f: string) => this.ctx.dictionary?.[k] ?? f
    const btn = this.root.querySelector<HTMLButtonElement>('[data-tb="save"]')
    const label = btn?.querySelector<HTMLElement>('[data-save-label]')
    if (!btn || !label) return
    btn.classList.add('is-saved')
    label.textContent = t('editor.saved', 'Saved')
    if (this.savedFlashTimer) window.clearTimeout(this.savedFlashTimer)
    this.savedFlashTimer = window.setTimeout(() => {
      btn.classList.remove('is-saved')
      this.refreshSaveButton()
      this.savedFlashTimer = null
    }, 1500)
  }

  private attachFilterBarEvents(): void {
    // "Add filter" button → opens the filter popover targeting the dashboard.
    const addBtn = this.root.querySelector<HTMLButtonElement>('[data-tb="add-filter"]')
    addBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.openFilterPopover(addBtn, { target: 'dashboard' })
    })

    // Reset clears all global filters.
    this.root.querySelector<HTMLButtonElement>('[data-tb="reset"]')?.addEventListener('click', () => {
      if (!this.dashboard.filters || this.dashboard.filters.length === 0) return
      this.dashboard.filters = []
      this.markDirty()
      this.refreshFilterBar()
      this.rerenderAllCharts()
    })

    // X on each chip removes that filter.
    this.root.querySelectorAll<HTMLElement>('[data-filter-remove]').forEach((x) => {
      x.addEventListener('click', (e) => {
        e.stopPropagation()
        const id = x.dataset.filterRemove
        if (!id) return
        this.removeGlobalFilter(id)
      })
    })
  }

  private refreshFilterBar(): void {
    const t = (k: string, f: string) => this.ctx.dictionary?.[k] ?? f
    const bar = this.root.querySelector<HTMLElement>('.dashjs-editor__filterbar')
    if (!bar) return
    // Re-render and re-bind.
    const wrapper = document.createElement('div')
    wrapper.innerHTML = this.renderFilterBar(t)
    const fresh = wrapper.firstElementChild
    if (fresh) bar.replaceWith(fresh)
    this.attachFilterBarEvents()
  }

  private removeGlobalFilter(id: string): void {
    this.dashboard.filters = (this.dashboard.filters ?? []).filter((f) => f.id !== id)
    this.markDirty()
    this.refreshFilterBar()
    this.rerenderAllCharts()
  }

  private gotoPageRelative(delta: number): void {
    const idx = this.dashboard.pages.findIndex((p) => p.dashboard_page_id === this.activePageId)
    if (idx < 0) return
    const next = idx + delta
    if (next < 0 || next >= this.dashboard.pages.length) return
    this.switchPage(this.dashboard.pages[next].dashboard_page_id)
  }

  private attachCanvasEvents(): void {
    // Click a chart card → select it.
    this.root.querySelectorAll<HTMLElement>('[data-chart-id]').forEach((card) => {
      card.addEventListener('click', (e) => {
        e.stopPropagation()
        const id = Number(card.dataset.chartId)
        this.selectChart(id)
      })

      // Field-drop target: dragover/drop fires only when the drag has our
      // custom field MIME type (ignores gridstack's own item drag).
      card.addEventListener('dragenter', (e) => {
        if (!this.isFieldDrag(e)) return
        e.preventDefault()
        card.classList.add('is-drop-target')
      })
      card.addEventListener('dragover', (e) => {
        if (!this.isFieldDrag(e)) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      })
      card.addEventListener('dragleave', (e) => {
        // Ignore dragleave when entering a descendant; only remove when
        // leaving the card boundary entirely.
        if (card.contains(e.relatedTarget as Node | null)) return
        card.classList.remove('is-drop-target')
      })
      card.addEventListener('drop', (e) => {
        if (!this.isFieldDrag(e)) return
        e.preventDefault()
        card.classList.remove('is-drop-target')
        const fid = e.dataTransfer?.getData('text/x-dashjs-field')
        if (!fid) return
        const id = Number(card.dataset.chartId)
        this.applyFieldToChart(id, fid)
      })
    })
    // Click empty canvas → deselect.
    this.root.querySelector<HTMLElement>('[data-canvas]')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-chart-id]')) return
      this.selectChart(null)
    })
  }

  /** Mount a floating popover under document.body and copy the dashjs scoping
   *  attributes so its CSS custom properties (--dashjs-*) resolve correctly. */
  private mountPopover(popover: HTMLElement): void {
    popover.setAttribute('data-dashjs', '')
    const theme = this.root.getAttribute('data-dashjs-theme')
    if (theme) popover.setAttribute('data-dashjs-theme', theme)
    document.body.appendChild(popover)
  }

  private isFieldDrag(e: DragEvent): boolean {
    const types = e.dataTransfer?.types
    if (!types) return false
    for (let i = 0; i < types.length; i++) {
      if (types[i] === 'text/x-dashjs-field') return true
    }
    return false
  }

  private applyFieldToChart(chartId: number, fieldId: string): void {
    const chart = this.activePage().charts?.find((c) => c.dashboard_chart_id === chartId)
    if (!chart) return
    const field = this.fields.find((f) => f.id === fieldId)
    if (!field) return
    // updateSlot mirrors to legacy fields, marks dirty, and triggers rerender.
    this.updateSlot(chart, 'dimension', { fieldId: field.id })
    // Select the chart so the user sees the change in Properties.
    this.selectChart(chartId)
    this.refreshPanels()
  }

  private attachFieldDragEvents(): void {
    const list = this.root.querySelector<HTMLElement>('.dashjs-fieldlist')
    if (!list) return
    list.querySelectorAll<HTMLElement>('[data-field]').forEach((row) => {
      row.addEventListener('dragstart', (e) => {
        const fid = row.dataset.field
        if (!fid || !e.dataTransfer) return
        e.dataTransfer.setData('text/x-dashjs-field', fid)
        e.dataTransfer.effectAllowed = 'copy'
        row.classList.add('is-dragging')
      })
      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging')
        // Belt-and-braces: clear any lingering drop-target highlights.
        this.root.querySelectorAll('.dashjs-card.is-drop-target')
          .forEach((c) => c.classList.remove('is-drop-target'))
      })
    })
  }

  /** Open a one-shot native file picker for CSV upload. Triggered by the
   *  toolbar "Add data" button — no persistent hidden input in the DOM. */
  private openCsvUpload(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,text/csv'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file) void this.loadCsvFile(file)
    })
    input.click()
  }

  /** Read + parse an uploaded CSV file, then take it as the new data source:
   *  field catalogue from the header row, chart series computed from the
   *  rows on every render. Surface a friendly error on parse failure. */
  private async loadCsvFile(file: File): Promise<void> {
    try {
      const text = await file.text()
      const { fields, rows } = parseCsv(text)
      if (fields.length === 0 || rows.length === 0) {
        console.warn('[dashjs] CSV is empty or malformed')
        return
      }
      this.csvData = { rows, fileName: file.name }
      this.fields = fields
      this.refreshPanels()
      this.rerenderAllCharts()
    } catch (err) {
      console.error('[dashjs] CSV upload failed', err)
    }
  }

  private clearCsv(): void {
    this.csvData = null
    this.fields = MOCK_FIELDS
    this.refreshPanels()
    this.rerenderAllCharts()
  }

  private attachFieldSearch(): void {
    const searchInput = this.root.querySelector<HTMLInputElement>('[data-field-search]')
    if (!searchInput) return
    searchInput.addEventListener('input', (e) => {
      this.fieldQuery = (e.target as HTMLInputElement).value
      const list = this.root.querySelector<HTMLElement>('.dashjs-fieldlist')
      if (list) list.innerHTML = this.filteredFields().map(this.renderField).join('')
      // Re-bind drag handlers on the freshly rendered rows.
      this.attachFieldDragEvents()
    })
  }

  private attachPropertyEvents(): void {
    const host = this.root.querySelector<HTMLElement>('[data-panel-host="properties"]')
    if (!host) return

    // Add-a-chart tile grid shown in the empty Properties state.
    host.querySelectorAll<HTMLButtonElement>('[data-add-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.addType as ChartType
        if (type) this.addChart(type)
      })
    })

    // Tab switcher (Setup / Style).
    host.querySelectorAll<HTMLButtonElement>('[data-prop-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.propTab as PropTab
        if (tab === this.activePropTab) return
        this.activePropTab = tab
        this.refreshPanels()
      })
    })

    this.attachStyleTabEvents(host)

    // Title input — re-render only the card header on change.
    const titleInput = host.querySelector<HTMLInputElement>('[data-prop="title"]')
    titleInput?.addEventListener('input', (e) => {
      const chart = this.selectedChart()
      if (!chart) return
      chart.dashboard_chart_title = (e.target as HTMLInputElement).value
      this.markDirty()
      const cardTitle = this.root.querySelector<HTMLElement>(
        `[data-chart-id="${chart.dashboard_chart_id}"] .dashjs-card__title`,
      )
      if (cardTitle) cardTitle.textContent = chart.dashboard_chart_title ?? ''
    })

    // Type tiles — change chart type, re-render that chart.
    host.querySelectorAll<HTMLButtonElement>('[data-prop="type"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chart = this.selectedChart()
        if (!chart) return
        const nextType = btn.dataset.value as ChartType
        if (nextType === chart.dashboard_chart_type) return
        chart.dashboard_chart_type = nextType
        this.markDirty()
        this.refreshPanels() // updates type tile active state
        this.rerenderChart(chart.dashboard_chart_id)
      })
    })

    this.attachChipEvents(host)

    // Add chart-level filter.
    const addFilterBtn = host.querySelector<HTMLButtonElement>('[data-action="add-chart-filter"]')
    addFilterBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      const chart = this.selectedChart()
      if (!chart) return
      this.openFilterPopover(addFilterBtn, { target: 'chart', chartId: chart.dashboard_chart_id })
    })

    // Remove chart-level filter chip.
    host.querySelectorAll<HTMLElement>('[data-chart-filter-remove]').forEach((x) => {
      x.addEventListener('click', (e) => {
        e.stopPropagation()
        const id = x.dataset.chartFilterRemove
        const chart = this.selectedChart()
        if (!id || !chart) return
        const cfg = chart.dashboard_chart_config
        if (cfg?.filters) {
          cfg.filters = cfg.filters.filter((f) => f.id !== id)
        }
        this.markDirty()
        this.refreshPanels()
        this.rerenderChart(chart.dashboard_chart_id)
      })
    })

    // Delete chart.
    host.querySelector<HTMLButtonElement>('[data-action="delete-chart"]')?.addEventListener('click', () => {
      const chart = this.selectedChart()
      if (!chart) return
      this.deleteChart(chart.dashboard_chart_id)
    })
  }

  private attachStyleTabEvents(host: HTMLElement): void {
    // Checkboxes — showValues, showLegend.
    host.querySelectorAll<HTMLInputElement>('[data-style="showValues"], [data-style="showLegend"]').forEach((el) => {
      el.addEventListener('change', () => {
        const chart = this.selectedChart()
        if (!chart) return
        const cfg = (chart.dashboard_chart_config ??= {})
        const labels = (cfg.labels ??= {})
        const key = el.dataset.style as 'showValues' | 'showLegend'
        labels[key] = el.checked
        this.markDirty()
        // Legend position row needs to show/hide when showLegend toggles.
        if (key === 'showLegend') this.refreshPanels()
        this.rerenderChart(chart.dashboard_chart_id)
      })
    })

    // Selects — legendPosition, valueFormat.
    host.querySelectorAll<HTMLSelectElement>('[data-style="legendPosition"], [data-style="valueFormat"]').forEach((el) => {
      el.addEventListener('change', () => {
        const chart = this.selectedChart()
        if (!chart) return
        const cfg = (chart.dashboard_chart_config ??= {})
        const labels = (cfg.labels ??= {})
        const key = el.dataset.style as 'legendPosition' | 'valueFormat'
        ;(labels as any)[key] = el.value
        this.markDirty()
        this.rerenderChart(chart.dashboard_chart_id)
      })
    })

    // Color swatches — palette[i] edit.
    host.querySelectorAll<HTMLInputElement>('[data-style="palette"]').forEach((el) => {
      el.addEventListener('input', () => {
        const chart = this.selectedChart()
        if (!chart) return
        const idx = Number(el.dataset.index)
        const cfg = (chart.dashboard_chart_config ??= {})
        const colors = (cfg.colors ??= { palette: [...paletteFor(cfg)] })
        // Make sure palette is long enough — clone from defaults if needed.
        if (!colors.palette || colors.palette.length === 0) {
          colors.palette = [...DEFAULT_PALETTE]
        }
        colors.palette[idx] = el.value
        // Update the visual chip alongside the native input live.
        const chip = el.parentElement?.querySelector<HTMLElement>('.dashjs-swatch__chip')
        if (chip) chip.style.background = el.value
        this.markDirty()
        this.rerenderChart(chart.dashboard_chart_id)
      })
    })

    // Reset palette button.
    host.querySelector<HTMLButtonElement>('[data-style="reset-palette"]')?.addEventListener('click', () => {
      const chart = this.selectedChart()
      if (!chart) return
      const cfg = chart.dashboard_chart_config
      if (cfg?.colors) {
        delete cfg.colors
        this.markDirty()
        this.refreshPanels()
        this.rerenderChart(chart.dashboard_chart_id)
      }
    })
  }

  private refreshPanels(): void {
    const t = (k: string, f: string) => this.ctx.dictionary?.[k] ?? f
    const body = this.root.querySelector<HTMLElement>('.dashjs-editor__body')!
    body.dataset.panel = this.panelStateAttr()

    const propsHost = this.root.querySelector<HTMLElement>('[data-panel-host="properties"]')!
    const dataHost = this.root.querySelector<HTMLElement>('[data-panel-host="data"]')!
    propsHost.innerHTML = this.panels.properties ? this.renderPropertiesPanel(t) : ''
    dataHost.innerHTML = this.panels.data ? this.renderDataPanel(t) : ''
    propsHost.setAttribute('aria-hidden', String(!this.panels.properties))
    dataHost.setAttribute('aria-hidden', String(!this.panels.data))

    this.root.querySelectorAll<HTMLButtonElement>('[data-rail]').forEach((btn) => {
      const key = btn.dataset.rail as PanelKey
      btn.classList.toggle('is-active', this.panels[key])
    })

    this.attachFieldSearch()
    this.attachFieldDragEvents()
    this.attachPropertyEvents()
  }

  // --- selection + chart lifecycle ---

  private selectChart(id: number | null): void {
    if (this.selectedChartId === id) return
    this.selectedChartId = id

    // Update card visual state.
    this.root.querySelectorAll<HTMLElement>('[data-chart-id]').forEach((card) => {
      card.classList.toggle('is-selected', Number(card.dataset.chartId) === id)
    })

    // Auto-open Properties panel on select.
    if (id !== null && !this.panels.properties) {
      this.panels.properties = true
    }
    this.refreshPanels()
  }

  private selectedChart(): DashboardChartRecord | null {
    if (this.selectedChartId === null) return null
    const charts = this.dashboard.pages[0]?.charts ?? []
    return charts.find((c) => c.dashboard_chart_id === this.selectedChartId) ?? null
  }

  private rerenderChart(id: number): void {
    void this.mountChart(id)
  }

  /** Mount/remount a single chart. Synchronous when there's no data source
   *  (the existing mock path). When a data source is provided, shows a
   *  loading placeholder, fetches data, and applies it on resolve — guarded
   *  by a per-chart fetch token so a stale earlier response can't overwrite
   *  a newer one. */
  private async mountChart(id: number): Promise<void> {
    const chart = this.activePage().charts?.find((c) => c.dashboard_chart_id === id)
    if (!chart) return

    // Dispose any existing Highcharts/Jspreadsheet instance for this chart.
    this.chartHandles.get(id)?.destroy()
    this.chartHandles.delete(id)

    const body = this.root.querySelector<HTMLElement>(
      `[data-chart-id="${id}"] [data-chart-body]`,
    )
    if (!body) return

    // Bump the fetch token so any in-flight earlier fetch for this chart
    // becomes a no-op when it resolves.
    const token = (this.chartFetchTokens.get(id) ?? 0) + 1
    this.chartFetchTokens.set(id, token)

    // CSV path — recompute series from the uploaded rows. Takes precedence
    // over both the host's dataSource and embedded series so the user can
    // experiment with their own data without wiring up a backend.
    if (this.csvData) {
      const view = this.computeChartViewFromCsv(chart)
      this.chartHandles.set(id, renderChart(body, view))
      return
    }

    if (!this.ctx.dataSource) {
      // Mock path — synchronous filter against embedded series.
      const view = applyFilters(chart, this.dashboard.filters ?? [])
      this.chartHandles.set(id, renderChart(body, view))
      return
    }

    // Live data path — show placeholder, fetch, then render.
    body.innerHTML = `<div class="dashjs-chart__placeholder">Loading…</div>`
    const allFilters = this.collectFiltersFor(chart)
    try {
      const series = await this.ctx.dataSource.getChartData(chart, allFilters)
      // Stale-response guard: skip if a newer request has been queued.
      if (this.chartFetchTokens.get(id) !== token) return
      // Body might have been destroyed by a page switch — re-query.
      const liveBody = this.root.querySelector<HTMLElement>(
        `[data-chart-id="${id}"] [data-chart-body]`,
      )
      if (!liveBody) return
      const view: DashboardChartRecord = { ...chart, series }
      this.chartHandles.set(id, renderChart(liveBody, view))
    } catch (err) {
      if (this.chartFetchTokens.get(id) !== token) return
      console.error('[dashjs] getChartData failed for chart', id, err)
      const liveBody = this.root.querySelector<HTMLElement>(
        `[data-chart-id="${id}"] [data-chart-body]`,
      )
      if (liveBody) liveBody.innerHTML = `<div class="dashjs-chart__placeholder">Failed to load data</div>`
    }
  }

  /** Union of dashboard-level + chart-level filters — what the data source
   *  needs to apply when fetching this chart's series. */
  private collectFiltersFor(chart: DashboardChartRecord): DashboardFilter[] {
    const globals = this.dashboard.filters ?? []
    const local = chart.dashboard_chart_config?.filters ?? []
    return [...globals, ...local]
  }

  /** Build a chart-view from the uploaded CSV: filter rows, group by the
   *  chart's dimension, aggregate per the chart's aggregation mode. Returns
   *  a clone of the chart with `series` (and `kpi_value` for KPI charts)
   *  populated. Charts without a dimension reduce to a single value. */
  private computeChartViewFromCsv(chart: DashboardChartRecord): DashboardChartRecord {
    if (!this.csvData) return chart
    const cfg = chart.dashboard_chart_config ?? {}
    const filters = this.collectFiltersFor(chart)

    // Read primary dimension + metric from slots (with legacy fallback).
    const dimSlot = readSlot(cfg, 'dimension')
    const metricSlot = readSlot(cfg, 'metric')
    const dimId = dimSlot.fieldId
    const agg = metricSlot.aggregation ?? 'count'
    const metricFieldId = metricSlot.fieldId

    // 1. Filter rows according to the chart's effective filter set.
    let rows = this.csvData.rows
    for (const f of filters) {
      rows = rows.filter((r) => {
        const v = String(r[f.fieldId] ?? '')
        const inSet = f.values.includes(v)
        return f.operator === 'in' || f.operator === 'eq' ? inSet : !inSet
      })
    }

    // 2. No dimension → single scalar (KPI, gauge, etc.).
    if (!dimId) {
      const value = this.aggregateRows(rows, agg, metricFieldId)
      return {
        ...chart,
        kpi_value: value,
        series: [{ name: 'Total', data: [{ label: 'Total', value }] }],
      }
    }

    // 3. Group by dimension, aggregate per group.
    const groups = new Map<string, Record<string, string>[]>()
    for (const row of rows) {
      const key = String(row[dimId] ?? '').trim()
      if (key === '') continue
      const bucket = groups.get(key) ?? []
      bucket.push(row)
      groups.set(key, bucket)
    }
    const perGroup = Array.from(groups.entries()).map(([label, groupRows]) => ({
      label,
      value: this.aggregateRows(groupRows, agg, metricFieldId),
    }))
    const grandTotal = perGroup.reduce((s, g) => s + g.value, 0) || 1
    let data = perGroup.map(({ label, value }) => ({
      label,
      value: agg === 'percentage' ? (value / grandTotal) * 100 : value,
    }))
    // Sort biggest-first so pies/bars read top-down by magnitude.
    data = data.sort((a, b) => b.value - a.value)

    const seriesName = this.fields.find((f) => f.id === dimId)?.name ?? 'Series'
    return {
      ...chart,
      series: [{ name: seriesName, data }],
    }
  }

  /** Aggregate a group of CSV rows into a single number per the requested
   *  mode. `count` ignores `fieldId`; `sum`/`mean` need a numeric field and
   *  fall back to row count when one isn't bound. `percentage` is handled
   *  by the caller (it needs the grand total). */
  private aggregateRows(
    rows: Record<string, string>[],
    agg: AggregationMode,
    fieldId: string | undefined,
  ): number {
    if (agg === 'count' || agg === 'percentage' || !fieldId) {
      return rows.length
    }
    const values = rows
      .map((r) => Number(r[fieldId]))
      .filter((v) => !isNaN(v))
    if (values.length === 0) return 0
    if (agg === 'sum') return values.reduce((s, v) => s + v, 0)
    if (agg === 'mean') return values.reduce((s, v) => s + v, 0) / values.length
    return rows.length
  }

  /** Tear down + rebuild the canvas (gridstack + charts) for the active page.
   *  Called after page switch, add chart, delete chart. */
  private remountActivePage(): void {
    this.disposeGrid()
    this.disposeCharts()
    const canvas = this.root.querySelector<HTMLElement>('[data-canvas]')
    if (!canvas) return
    canvas.innerHTML = this.renderCanvasContent()
    const pageFoot = this.root.querySelector<HTMLElement>('[data-page-foot]')
    if (pageFoot) pageFoot.innerHTML = this.renderPageTabs()
    this.initGrid()
    this.mountAllCharts()
    this.attachCanvasEvents()
    this.attachPageTabEvents()
  }

  private mountAllCharts(): void {
    for (const c of this.activePage().charts ?? []) {
      void this.mountChart(c.dashboard_chart_id)
    }
  }

  /** Re-render every chart on the active page (used when global filters change). */
  private rerenderAllCharts(): void {
    for (const c of this.activePage().charts ?? []) {
      this.rerenderChart(c.dashboard_chart_id)
    }
  }

  private disposeCharts(): void {
    for (const h of this.chartHandles.values()) {
      try { h.destroy() } catch { /* ignore */ }
    }
    this.chartHandles.clear()
  }

  // --- gridstack ---

  private initGrid(): void {
    const gridEl = this.root.querySelector<HTMLElement>('[data-grid-root]')
    if (!gridEl) return
    this.grid = GridStack.init(
      {
        column: GRID_COLUMNS,
        cellHeight: GRID_ROW_HEIGHT,
        // Note: the actual visible gap between cards is enforced by our CSS
        // (see [data-dashjs] .grid-stack > .grid-stack-item > .grid-stack-item-content)
        // because gridstack's `margin` option doesn't apply uniformly to all
        // four sides in v12. We still pass margin: 0 so gridstack doesn't add
        // its own inset on top of ours.
        margin: 0,
        float: false,
        animate: true,
        // Grid items (DOM children with .grid-stack-item) self-register from
        // their gs-x/gs-y/gs-w/gs-h attributes.
      },
      gridEl,
    )

    this.grid.on('change', (_e, items) => this.onGridChange(items as GridStackNode[]))
    // Reflow Highcharts whenever an item's pixel size has settled.
    this.grid.on('resizestop', (_e, el) => this.reflowChartIn(el as GridItemHTMLElement))
  }

  private disposeGrid(): void {
    if (!this.grid) return
    try { this.grid.destroy(false) } catch { /* ignore */ }
    this.grid = null
  }

  private onGridChange(items: GridStackNode[]): void {
    const charts = this.activePage().charts ?? []
    let changed = false
    for (const it of items) {
      const id = Number((it.el as HTMLElement | undefined)?.dataset?.chartId)
      if (!id) continue
      const chart = charts.find((c) => c.dashboard_chart_id === id)
      if (!chart) continue
      if (typeof it.x === 'number' && chart.dashboard_chart_x !== it.x) { chart.dashboard_chart_x = it.x; changed = true }
      if (typeof it.y === 'number' && chart.dashboard_chart_y !== it.y) { chart.dashboard_chart_y = it.y; changed = true }
      if (typeof it.w === 'number' && chart.dashboard_chart_w !== it.w) { chart.dashboard_chart_w = it.w; changed = true }
      if (typeof it.h === 'number' && chart.dashboard_chart_h !== it.h) { chart.dashboard_chart_h = it.h; changed = true }
    }
    if (changed) this.markDirty()
    // After move/resize finishes, reflow charts whose containers changed size.
    for (const it of items) {
      this.reflowChartIn(it.el as GridItemHTMLElement)
    }
  }

  private reflowChartIn(el: GridItemHTMLElement | undefined): void {
    if (!el) return
    const id = Number(el.dataset.chartId)
    if (!id) return
    const handle = this.chartHandles.get(id) as { highchart?: { reflow(): void } } | undefined
    // Easiest: just rerender. Highcharts is fast enough; Jspreadsheet stays
    // consistent with new column widths.
    this.rerenderChart(id)
  }

  // --- page tabs ---

  private attachPageTabEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-page-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.pageTab)
        this.switchPage(id)
      })
    })
    this.root.querySelector<HTMLButtonElement>('[data-page-add]')?.addEventListener('click', () => {
      this.addPage()
    })
  }

  private switchPage(pageId: number): void {
    if (pageId === this.activePageId) return
    if (!this.dashboard.pages.find((p) => p.dashboard_page_id === pageId)) return
    this.activePageId = pageId
    this.selectedChartId = null
    this.remountActivePage()
    this.refreshPanels()
    this.updatePageLabel()
  }

  private addPage(): void {
    const nextId = this.dashboard.pages.reduce((m, p) => Math.max(m, p.dashboard_page_id), 0) + 1
    this.dashboard.pages.push({
      dashboard_page_id: nextId,
      dashboard_page_name: `Page ${nextId}`,
      charts: [],
    })
    this.markDirty()
    this.activePageId = nextId
    this.selectedChartId = null
    this.remountActivePage()
    this.refreshPanels()
    this.updatePageLabel()
  }

  private updatePageLabel(): void {
    const idx = this.dashboard.pages.findIndex((p) => p.dashboard_page_id === this.activePageId)
    const label = this.root.querySelector<HTMLElement>('.dashjs-editor__pagelabel')
    if (label) label.textContent = `Page ${idx + 1} / ${this.dashboard.pages.length}`
  }

  private toggleAddChartPopover(anchor: HTMLElement): void {
    if (this.addChartOpen) {
      this.closeAddChartPopover()
      return
    }
    this.openAddChartPopover(anchor)
  }

  private openAddChartPopover(anchor: HTMLElement): void {
    this.addChartOpen = true
    anchor.classList.add('is-active')

    const popover = document.createElement('div')
    popover.className = 'dashjs-popover dashjs-popover--add-chart'
    popover.setAttribute('data-popover', 'add-chart')

    popover.innerHTML = `
      <div class="dashjs-popover__title">Add a chart</div>
      ${this.renderAddChartTiles()}
    `

    // Position under the anchor button.
    const rect = anchor.getBoundingClientRect()
    popover.style.position = 'fixed'
    popover.style.top = `${rect.bottom + 4}px`
    popover.style.left = `${rect.left}px`
    popover.style.zIndex = '1000'
    this.mountPopover(popover)

    popover.querySelectorAll<HTMLButtonElement>('[data-add-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.addType as ChartType
        this.addChart(type)
        this.closeAddChartPopover()
      })
    })

    // Close on outside click.
    this.outsideClickHandler = (e: MouseEvent) => {
      const target = e.target as Node
      if (popover.contains(target) || anchor.contains(target)) return
      this.closeAddChartPopover()
    }
    // Close on Escape.
    this.escKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeAddChartPopover()
    }
    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler!)
      document.addEventListener('keydown', this.escKeyHandler!)
    }, 0)
  }

  private closeAddChartPopover(): void {
    if (!this.addChartOpen) return
    this.addChartOpen = false
    const anchor = this.root.querySelector<HTMLButtonElement>('[data-tb="add-chart"]')
    anchor?.classList.remove('is-active')
    document.querySelector('[data-popover="add-chart"]')?.remove()
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler)
      this.outsideClickHandler = null
    }
    if (this.escKeyHandler) {
      document.removeEventListener('keydown', this.escKeyHandler)
      this.escKeyHandler = null
    }
  }

  // --- chip events + slot popovers ---

  /** Wire clicks on every slot chip inside the Properties host. Three
   *  actions per chip — open the field picker, open the aggregation picker,
   *  or clear the binding. Chips also accept drops from the Data panel. */
  private attachChipEvents(host: HTMLElement): void {
    host.querySelectorAll<HTMLElement>('[data-chip-slot]').forEach((chip) => {
      const slotId = chip.dataset.chipSlot
      const kind = chip.dataset.chipKind as 'dimension' | 'metric'
      if (!slotId) return

      // Action buttons inside the chip — open-field / open-agg / remove.
      chip.querySelectorAll<HTMLElement>('[data-chip-action]').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          const action = el.dataset.chipAction
          if (action === 'open-field') this.openSlotFieldPicker(el, slotId)
          else if (action === 'open-agg') this.openSlotAggPicker(el, slotId)
          else if (action === 'remove') this.clearSlot(slotId)
        })
      })

      // Whole empty-chip click opens the field picker too (the inner button
      // may not be the click target on some clicks).
      if (chip.classList.contains('dashjs-chip--empty')) {
        chip.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('[data-chip-action]')) return
          this.openSlotFieldPicker(chip, slotId)
        })
      }

      // Drop target — accept a field drag from the Data panel.
      chip.addEventListener('dragenter', (e) => {
        if (!this.isFieldDrag(e)) return
        e.preventDefault()
        chip.classList.add('is-drop-target')
      })
      chip.addEventListener('dragover', (e) => {
        if (!this.isFieldDrag(e)) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      })
      chip.addEventListener('dragleave', (e) => {
        if (chip.contains(e.relatedTarget as Node | null)) return
        chip.classList.remove('is-drop-target')
      })
      chip.addEventListener('drop', (e) => {
        if (!this.isFieldDrag(e)) return
        e.preventDefault()
        chip.classList.remove('is-drop-target')
        const fid = e.dataTransfer?.getData('text/x-dashjs-field')
        if (!fid) return
        const chart = this.selectedChart()
        if (!chart) return
        this.updateSlot(chart, slotId, { fieldId: fid })
        this.refreshPanels()
      })

      // Suppress drag-cursor on the outer chip (it's draggable: false by default
      // but the inner buttons can still pick up mousedown drags).
      void kind
    })
  }

  private clearSlot(slotId: string): void {
    const chart = this.selectedChart()
    if (!chart) return
    const cfg = chart.dashboard_chart_config
    if (!cfg?.slots?.[slotId] && !(slotId === 'dimension' && cfg?.dimension)) return
    delete cfg.slots?.[slotId]
    if (slotId === 'dimension') delete cfg.dimension
    if (slotId === 'metric') delete cfg.aggregation
    this.markDirty()
    this.refreshPanels()
    this.rerenderChart(chart.dashboard_chart_id)
  }

  /** Open the field picker popover anchored to the chip. Shows the full
   *  field catalogue filtered by an optional slot.fieldTypes hint, with a
   *  search box. Picking a field updates the slot. */
  private openSlotFieldPicker(anchor: HTMLElement, slotId: string): void {
    this.closeSlotPopovers()
    const chart = this.selectedChart()
    if (!chart) return
    const schema = CHART_TYPE_SCHEMAS[chart.dashboard_chart_type]
    const slot = schema.slots.find((s) => s.id === slotId)
    if (!slot) return

    const popover = document.createElement('div')
    popover.className = 'dashjs-popover dashjs-popover--fieldpicker'
    popover.setAttribute('data-popover', 'fieldpicker')

    const renderList = (query: string) => {
      const q = query.trim().toLowerCase()
      const available = slot.fieldTypes && slot.fieldTypes.length > 0
        ? this.fields.filter((f) => slot.fieldTypes!.includes(f.type))
        : this.fields
      // For metric slots: prefer numeric fields up top + offer Record Count.
      const isMetric = slot.kind === 'metric'
      const sorted = isMetric
        ? [...available].sort((a, b) => (a.type === 'numeric' ? -1 : 0) - (b.type === 'numeric' ? -1 : 0))
        : available
      const filtered = q ? sorted.filter((f) => f.name.toLowerCase().includes(q)) : sorted

      let html = ''
      // Record Count virtual entry — only on metric slots, only when the
      // search query doesn't filter it out.
      if (isMetric && (!q || 'record count'.includes(q))) {
        html += `
          <li class="dashjs-fieldpicker__item dashjs-fieldpicker__item--virtual" data-pick-record-count>
            <span class="dashjs-chip__badge dashjs-chip__badge--metric">CT</span>
            <span>Record Count</span>
          </li>
        `
      }
      html += filtered.map((f) => {
        const badge = fieldTypeBadge(f.type)
        return `
          <li class="dashjs-fieldpicker__item" data-pick-field="${f.id}">
            <span class="dashjs-chip__badge" style="background:${badge.color}">${badge.label}</span>
            <span>${escape(f.name)}</span>
          </li>
        `
      }).join('')
      return html || `<li class="dashjs-fieldpicker__empty">No matching fields</li>`
    }

    popover.innerHTML = `
      <input class="dashjs-form__input" data-fieldpicker-search type="search" placeholder="Search fields" />
      <ul class="dashjs-fieldpicker__list" data-fieldpicker-list>${renderList('')}</ul>
    `

    const rect = anchor.getBoundingClientRect()
    popover.style.position = 'fixed'
    popover.style.top = `${rect.bottom + 4}px`
    popover.style.left = `${rect.left}px`
    popover.style.zIndex = '1001'
    popover.style.minWidth = `${Math.max(rect.width, 240)}px`
    this.mountPopover(popover)

    const search = popover.querySelector<HTMLInputElement>('[data-fieldpicker-search]')!
    const list = popover.querySelector<HTMLElement>('[data-fieldpicker-list]')!
    setTimeout(() => search.focus(), 30)

    const bindItemClicks = () => {
      list.querySelectorAll<HTMLElement>('[data-pick-field]').forEach((li) => {
        li.addEventListener('click', () => {
          const fid = li.dataset.pickField
          if (!fid) return
          this.updateSlot(chart, slotId, { fieldId: fid })
          this.closeSlotPopovers()
          this.refreshPanels()
        })
      })
      // Record Count = no field + count agg.
      list.querySelector<HTMLElement>('[data-pick-record-count]')?.addEventListener('click', () => {
        this.updateSlot(chart, slotId, { fieldId: undefined, aggregation: 'count' })
        this.closeSlotPopovers()
        this.refreshPanels()
      })
    }
    bindItemClicks()
    search.addEventListener('input', () => {
      list.innerHTML = renderList(search.value)
      bindItemClicks()
    })

    this.outsideClickHandler = (e: MouseEvent) => {
      if (popover.contains(e.target as Node) || anchor.contains(e.target as Node)) return
      this.closeSlotPopovers()
    }
    this.escKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeSlotPopovers()
    }
    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler!)
      document.addEventListener('keydown', this.escKeyHandler!)
    }, 0)
  }

  /** Open the aggregation picker for a metric slot — 4 buttons, one per
   *  AggregationMode. Clicking sets the slot's aggregation. */
  private openSlotAggPicker(anchor: HTMLElement, slotId: string): void {
    this.closeSlotPopovers()
    const chart = this.selectedChart()
    if (!chart) return
    const current = readSlot(chart.dashboard_chart_config, slotId).aggregation ?? 'count'

    const popover = document.createElement('div')
    popover.className = 'dashjs-popover dashjs-popover--agg'
    popover.setAttribute('data-popover', 'agg')
    popover.innerHTML = AGGREGATION_OPTIONS.map((o) => `
      <button class="${o.value === current ? 'is-active' : ''}" data-pick-agg="${o.value}">${o.label}</button>
    `).join('')

    const rect = anchor.getBoundingClientRect()
    popover.style.position = 'fixed'
    popover.style.top = `${rect.bottom + 4}px`
    popover.style.left = `${rect.left}px`
    popover.style.zIndex = '1001'
    this.mountPopover(popover)

    popover.querySelectorAll<HTMLButtonElement>('[data-pick-agg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const agg = btn.dataset.pickAgg as AggregationMode
        this.updateSlot(chart, slotId, { aggregation: agg })
        this.closeSlotPopovers()
        this.refreshPanels()
      })
    })

    this.outsideClickHandler = (e: MouseEvent) => {
      if (popover.contains(e.target as Node) || anchor.contains(e.target as Node)) return
      this.closeSlotPopovers()
    }
    this.escKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeSlotPopovers()
    }
    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler!)
      document.addEventListener('keydown', this.escKeyHandler!)
    }, 0)
  }

  private closeSlotPopovers(): void {
    document.querySelectorAll('[data-popover="fieldpicker"], [data-popover="agg"]').forEach((el) => el.remove())
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler)
      this.outsideClickHandler = null
    }
    if (this.escKeyHandler) {
      document.removeEventListener('keydown', this.escKeyHandler)
      this.escKeyHandler = null
    }
  }

  // --- filter popover (reused by global + chart-level) ---

  private openFilterPopover(
    anchor: HTMLElement,
    target: { target: 'dashboard' } | { target: 'chart'; chartId: number },
  ): void {
    this.closeFilterPopover()
    anchor.classList.add('is-active')

    const popover = document.createElement('div')
    popover.className = 'dashjs-popover dashjs-popover--filter'
    popover.setAttribute('data-popover', 'filter')
    popover.innerHTML = `
      <div class="dashjs-popover__title">${target.target === 'chart' ? 'Add chart filter' : 'Add filter'}</div>
      <div class="dashjs-form">
        <div class="dashjs-form__row">
          <label class="dashjs-form__label">Field</label>
          <select class="dashjs-form__input" data-filter-field>
            <option value="">— Choose a field —</option>
            ${this.fields.map((f) => `<option value="${f.id}">${escape(f.name)}</option>`).join('')}
          </select>
        </div>
        <div class="dashjs-form__row">
          <label class="dashjs-form__label">Operator</label>
          <select class="dashjs-form__input" data-filter-op>
            <option value="in">is one of</option>
            <option value="not_in">is not one of</option>
            <option value="eq">equals</option>
            <option value="neq">does not equal</option>
          </select>
        </div>
        <div class="dashjs-form__row">
          <label class="dashjs-form__label">Values <span class="dashjs-form__hint">(comma-separated)</span></label>
          <input class="dashjs-form__input" data-filter-values type="text" placeholder="e.g. Strongly agree, Agree" />
        </div>
        <div class="dashjs-form__actions">
          <button class="dashjs-btn" data-filter-cancel>Cancel</button>
          <button class="dashjs-btn dashjs-btn--primary" data-filter-apply>Apply</button>
        </div>
      </div>
    `

    const rect = anchor.getBoundingClientRect()
    popover.style.position = 'fixed'
    popover.style.top = `${rect.bottom + 4}px`
    popover.style.left = `${rect.left}px`
    popover.style.zIndex = '1000'
    popover.style.minWidth = '320px'
    this.mountPopover(popover)

    const fieldSel = popover.querySelector<HTMLSelectElement>('[data-filter-field]')!
    const opSel   = popover.querySelector<HTMLSelectElement>('[data-filter-op]')!
    const valsIn  = popover.querySelector<HTMLInputElement>('[data-filter-values]')!

    setTimeout(() => fieldSel.focus(), 50)

    popover.querySelector<HTMLButtonElement>('[data-filter-cancel]')?.addEventListener('click', () => {
      this.closeFilterPopover()
    })
    popover.querySelector<HTMLButtonElement>('[data-filter-apply]')?.addEventListener('click', () => {
      const fieldId = fieldSel.value
      if (!fieldId) { fieldSel.focus(); return }
      const field = this.fields.find((f) => f.id === fieldId)
      if (!field) return
      const values = valsIn.value.split(',').map((s) => s.trim()).filter(Boolean)
      if (values.length === 0) { valsIn.focus(); return }

      const filter: DashboardFilter = {
        id: 'f' + Date.now(),
        fieldId,
        fieldName: field.name,
        operator: (opSel.value || 'in') as FilterOperator,
        values,
      }

      if (target.target === 'dashboard') {
        (this.dashboard.filters ??= []).push(filter)
        this.markDirty()
        this.refreshFilterBar()
        this.rerenderAllCharts()
      } else {
        const chart = this.activePage().charts?.find((c) => c.dashboard_chart_id === target.chartId)
        if (chart) {
          const cfg = (chart.dashboard_chart_config ??= {})
          ;(cfg.filters ??= []).push(filter)
          this.markDirty()
          this.refreshPanels()
          this.rerenderChart(chart.dashboard_chart_id)
        }
      }
      this.closeFilterPopover()
    })

    this.outsideClickHandler = (e: MouseEvent) => {
      const target2 = e.target as Node
      if (popover.contains(target2) || anchor.contains(target2)) return
      this.closeFilterPopover()
    }
    this.escKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeFilterPopover()
    }
    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler!)
      document.addEventListener('keydown', this.escKeyHandler!)
    }, 0)
  }

  private closeFilterPopover(): void {
    const popover = document.querySelector('[data-popover="filter"]')
    if (!popover) return
    popover.remove()
    this.root.querySelectorAll<HTMLElement>('[data-tb="add-filter"], [data-action="add-chart-filter"]')
      .forEach((el) => el.classList.remove('is-active'))
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler)
      this.outsideClickHandler = null
    }
    if (this.escKeyHandler) {
      document.removeEventListener('keydown', this.escKeyHandler)
      this.escKeyHandler = null
    }
  }

  private addChart(type: ChartType): void {
    const page = this.activePage()
    const charts = (page.charts ??= [])

    // Next id = max + 1, scoped to whole dashboard so ids are unique across pages.
    const nextId = this.dashboard.pages
      .flatMap((p) => p.charts ?? [])
      .reduce((m, c) => Math.max(m, c.dashboard_chart_id), 0) + 1

    // Place below all existing charts on this page.
    const nextY = charts.reduce((m, c) => {
      const bottom = (c.dashboard_chart_y ?? 0) + (c.dashboard_chart_h ?? 4)
      return Math.max(m, bottom)
    }, 0)

    const newChart = createDefaultChart(type, nextId, {
      pageId: page.dashboard_page_id,
      x: 0,
      y: nextY,
    })
    charts.push(newChart)
    this.markDirty()

    this.remountActivePage()
    this.selectChart(newChart.dashboard_chart_id)

    // Scroll new chart into view.
    const newCard = this.root.querySelector<HTMLElement>(
      `[data-chart-id="${newChart.dashboard_chart_id}"]`,
    )
    newCard?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  private deleteChart(id: number): void {
    const page = this.activePage()
    if (!page.charts) return
    page.charts = page.charts.filter((c) => c.dashboard_chart_id !== id)
    this.markDirty()
    this.selectedChartId = null
    this.remountActivePage()
    this.refreshPanels()
  }

  private filteredFields(): DataField[] {
    const q = this.fieldQuery.trim().toLowerCase()
    if (!q) return this.fields
    return this.fields.filter((f) => f.name.toLowerCase().includes(q))
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
