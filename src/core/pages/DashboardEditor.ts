// DashboardEditor — Looker-Studio-inspired editor.
// Phase A: charts render from a real dashboard data structure, selection
// model, Properties panel populates with selected chart's config, edits
// re-render the chart live.

import { GridStack, type GridItemHTMLElement, type GridStackNode } from 'gridstack'
import type { DashboardFull, DashboardChartRecord, ChartType, AggregationMode, DashboardPageRecord, DashboardFilter, FilterOperator } from '../domain'
import { renderChart, type ChartHandle } from '../charts/renderChart'
import { createDefaultChart } from '../charts/defaults'
import { applyFilters } from '../charts/applyFilters'
import { icon } from '../icons'
import { MOCK_FIELDS, fieldTypeBadge, type DataField } from '../mockData'

const GRID_COLUMNS = 12
/** Pixel height of one grid row. Determines chart heights together with `h`. */
const GRID_ROW_HEIGHT = 60

export interface DashboardEditorContext {
  dashboard: DashboardFull
  dictionary?: Record<string, string>
}

type PanelKey = 'data' | 'properties'
interface PanelState { data: boolean; properties: boolean }

const CHART_TYPE_OPTIONS: { type: ChartType; label: string; iconKey: string }[] = [
  { type: 'bar',   label: 'Bar',   iconKey: 'chart' },
  { type: 'line',  label: 'Line',  iconKey: 'chart' },
  { type: 'pie',   label: 'Pie',   iconKey: 'chart' },
  { type: 'kpi',   label: 'KPI',   iconKey: 'chart' },
  { type: 'table', label: 'Table', iconKey: 'chart' },
]

const AGGREGATION_OPTIONS: { value: AggregationMode; label: string }[] = [
  { value: 'count',      label: 'Count' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'mean',       label: 'Mean' },
  { value: 'sum',        label: 'Sum' },
]

export class DashboardEditor {
  private root: HTMLElement
  private ctx: DashboardEditorContext
  private dashboard: DashboardFull
  private chartHandles = new Map<number, ChartHandle>()
  private selectedChartId: number | null = null
  private activePageId: number
  private grid: GridStack | null = null
  private panels: PanelState = { data: true, properties: false }
  private fieldQuery = ''
  private addChartOpen = false
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
          <div class="dashjs-editor__canvas" data-canvas>
            ${this.renderCanvasContent()}
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
  }

  destroy(): void {
    this.closeAddChartPopover()
    this.closeFilterPopover()
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
      </div>
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
      ${this.renderPageTabs()}
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
          <span>${escape(this.dashboard.survey_name ?? 'Data source')}</span>
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
        </div>
      `
    }
    return this.renderPropertiesForChart(chart, t)
  }

  private renderPropertiesForChart(chart: DashboardChartRecord, t: (k: string, f: string) => string): string {
    const cfg = chart.dashboard_chart_config ?? {}
    const dim = cfg.dimension
    const agg = cfg.aggregation ?? 'count'

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

    const dimensionOptions = MOCK_FIELDS.map((f) => `
      <option value="${f.id}" ${dim?.questionCode === f.id ? 'selected' : ''}>${escape(f.name)}</option>
    `).join('')

    const aggOptions = AGGREGATION_OPTIONS.map((o) => `
      <option value="${o.value}" ${agg === o.value ? 'selected' : ''}>${o.label}</option>
    `).join('')

    return `
      <div class="dashjs-panel">
        <div class="dashjs-panel__header">
          ${icon('pencil', { size: 16 })}
          <span class="dashjs-panel__title">${t('editor.properties', 'Properties')}</span>
        </div>
        <div class="dashjs-tabs">
          <button class="dashjs-tabs__btn is-active">${t('editor.tabSetup', 'Setup')}</button>
          <button class="dashjs-tabs__btn" disabled title="Phase E">${t('editor.tabStyle', 'Style')}</button>
        </div>
        <div class="dashjs-props">
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

          <div class="dashjs-props__section">
            <label class="dashjs-props__label">${t('editor.dimension', 'Dimension')}</label>
            <select class="dashjs-form__input" data-prop="dimension">
              <option value="">— None —</option>
              ${dimensionOptions}
            </select>
          </div>

          <div class="dashjs-props__section">
            <label class="dashjs-props__label">${t('editor.aggregation', 'Aggregation')}</label>
            <select class="dashjs-form__input" data-prop="aggregation">
              ${aggOptions}
            </select>
          </div>

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
        </div>
      </div>
    `
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

    this.attachFilterBarEvents()
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
      this.dashboard.filters = []
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
    })
    // Click empty canvas → deselect.
    this.root.querySelector<HTMLElement>('[data-canvas]')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-chart-id]')) return
      this.selectChart(null)
    })
  }

  private attachFieldSearch(): void {
    const searchInput = this.root.querySelector<HTMLInputElement>('[data-field-search]')
    if (!searchInput) return
    searchInput.addEventListener('input', (e) => {
      this.fieldQuery = (e.target as HTMLInputElement).value
      const list = this.root.querySelector<HTMLElement>('.dashjs-fieldlist')
      if (list) list.innerHTML = this.filteredFields().map(this.renderField).join('')
    })
  }

  private attachPropertyEvents(): void {
    const host = this.root.querySelector<HTMLElement>('[data-panel-host="properties"]')
    if (!host) return

    // Title input — re-render only the card header on change.
    const titleInput = host.querySelector<HTMLInputElement>('[data-prop="title"]')
    titleInput?.addEventListener('input', (e) => {
      const chart = this.selectedChart()
      if (!chart) return
      chart.dashboard_chart_title = (e.target as HTMLInputElement).value
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
        this.refreshPanels() // updates type tile active state
        this.rerenderChart(chart.dashboard_chart_id)
      })
    })

    // Dimension select.
    const dimSelect = host.querySelector<HTMLSelectElement>('[data-prop="dimension"]')
    dimSelect?.addEventListener('change', (e) => {
      const chart = this.selectedChart()
      if (!chart) return
      const id = (e.target as HTMLSelectElement).value
      const cfg = (chart.dashboard_chart_config ??= {})
      if (!id) {
        delete cfg.dimension
      } else {
        const f = MOCK_FIELDS.find((m) => m.id === id)
        if (f) cfg.dimension = { questionCode: f.id, questionText: f.name, questionId: 0 }
      }
      this.rerenderChart(chart.dashboard_chart_id)
    })

    // Aggregation select.
    const aggSelect = host.querySelector<HTMLSelectElement>('[data-prop="aggregation"]')
    aggSelect?.addEventListener('change', (e) => {
      const chart = this.selectedChart()
      if (!chart) return
      const cfg = (chart.dashboard_chart_config ??= {})
      cfg.aggregation = (e.target as HTMLSelectElement).value as AggregationMode
      this.rerenderChart(chart.dashboard_chart_id)
    })

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
    const chart = this.activePage().charts?.find((c) => c.dashboard_chart_id === id)
    if (!chart) return

    // Dispose existing instance.
    this.chartHandles.get(id)?.destroy()
    this.chartHandles.delete(id)

    // Find body element and remount.
    const body = this.root.querySelector<HTMLElement>(
      `[data-chart-id="${id}"] [data-chart-body]`,
    )
    if (!body) return
    const view = applyFilters(chart, this.dashboard.filters ?? [])
    this.chartHandles.set(id, renderChart(body, view))
  }

  /** Tear down + rebuild the canvas (gridstack + charts) for the active page.
   *  Called after page switch, add chart, delete chart. */
  private remountActivePage(): void {
    this.disposeGrid()
    this.disposeCharts()
    const canvas = this.root.querySelector<HTMLElement>('[data-canvas]')
    if (!canvas) return
    canvas.innerHTML = this.renderCanvasContent()
    this.initGrid()
    this.mountAllCharts()
    this.attachCanvasEvents()
    this.attachPageTabEvents()
  }

  private mountAllCharts(): void {
    const globals = this.dashboard.filters ?? []
    for (const c of this.activePage().charts ?? []) {
      const body = this.root.querySelector<HTMLElement>(
        `[data-chart-id="${c.dashboard_chart_id}"] [data-chart-body]`,
      )
      if (!body) continue
      const view = applyFilters(c, globals)
      this.chartHandles.set(c.dashboard_chart_id, renderChart(body, view))
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
        margin: 6,
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
    for (const it of items) {
      const id = Number((it.el as HTMLElement | undefined)?.dataset?.chartId)
      if (!id) continue
      const chart = charts.find((c) => c.dashboard_chart_id === id)
      if (!chart) continue
      if (typeof it.x === 'number') chart.dashboard_chart_x = it.x
      if (typeof it.y === 'number') chart.dashboard_chart_y = it.y
      if (typeof it.w === 'number') chart.dashboard_chart_w = it.w
      if (typeof it.h === 'number') chart.dashboard_chart_h = it.h
    }
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

    const tiles: { type: ChartType; label: string }[] = [
      { type: 'bar',   label: 'Bar' },
      { type: 'line',  label: 'Line' },
      { type: 'pie',   label: 'Pie' },
      { type: 'kpi',   label: 'KPI' },
      { type: 'table', label: 'Table' },
    ]
    popover.innerHTML = `
      <div class="dashjs-popover__title">Add a chart</div>
      <div class="dashjs-typegrid">
        ${tiles.map((tile) => `
          <button class="dashjs-typetile" data-add-type="${tile.type}" title="${tile.label}">
            <span class="dashjs-typetile__icon">${icon('chart', { size: 18 })}</span>
            <span class="dashjs-typetile__label">${tile.label}</span>
          </button>
        `).join('')}
      </div>
    `

    // Position under the anchor button.
    const rect = anchor.getBoundingClientRect()
    popover.style.position = 'fixed'
    popover.style.top = `${rect.bottom + 4}px`
    popover.style.left = `${rect.left}px`
    popover.style.zIndex = '1000'
    document.body.appendChild(popover)

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
            ${MOCK_FIELDS.map((f) => `<option value="${f.id}">${escape(f.name)}</option>`).join('')}
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
    document.body.appendChild(popover)

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
      const field = MOCK_FIELDS.find((f) => f.id === fieldId)
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
        this.refreshFilterBar()
        this.rerenderAllCharts()
      } else {
        const chart = this.activePage().charts?.find((c) => c.dashboard_chart_id === target.chartId)
        if (chart) {
          const cfg = (chart.dashboard_chart_config ??= {})
          ;(cfg.filters ??= []).push(filter)
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
    this.selectedChartId = null
    this.remountActivePage()
    this.refreshPanels()
  }

  private filteredFields(): DataField[] {
    const q = this.fieldQuery.trim().toLowerCase()
    if (!q) return MOCK_FIELDS
    return MOCK_FIELDS.filter((f) => f.name.toLowerCase().includes(q))
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
