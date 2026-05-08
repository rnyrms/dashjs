// DashboardList — renders a Jspreadsheet worksheet of the user's dashboards.
// Eats our own dogfood: the listing IS a Jspreadsheet instance.

import jspreadsheet from 'jspreadsheet'
import type { DashboardRecord } from '../domain'
import type { DashJsApi, DashJsOptions } from '../types'
import { icon } from '../icons'

export interface DashboardListContext {
  dashboards: DashboardRecord[]
  api?: Partial<DashJsApi>
  onCreate?: DashJsOptions['onCreate']
  onOpen?: DashJsOptions['onOpen']
  onDelete?: DashJsOptions['onDelete']
  dictionary?: Record<string, string>
}

export class DashboardList {
  private root: HTMLElement
  private gridEl: HTMLElement | null = null
  private worksheets: ReturnType<typeof jspreadsheet> | null = null
  private ctx: DashboardListContext

  constructor(root: HTMLElement, ctx: DashboardListContext) {
    this.root = root
    this.ctx = ctx
  }

  render(): void {
    const t = (key: string, fallback: string) => this.ctx.dictionary?.[key] ?? fallback

    this.root.innerHTML = `
      <div class="dashjs-list">
        <div class="dashjs-list__header">
          <div>
            <h1 class="dashjs-list__title">${t('list.title', 'Dashboards')}</h1>
            <div class="dashjs-list__subtitle">${t('list.subtitle', 'Survey dashboards in your workspace')}</div>
          </div>
        </div>
        <div class="dashjs-table" data-grid></div>
        <div class="dashjs-create">
          <div class="dashjs-create__title">${t('list.create', 'Create new dashboard')}</div>
          <div class="dashjs-create__row">
            <input
              class="dashjs-form__input dashjs-create__input"
              data-create-name
              type="text"
              placeholder="${t('list.modal.namePlaceholder', 'Q1 results')}"
            />
            <button class="dashjs-btn dashjs-btn--primary" data-action="create">
              ${icon('plus', { size: 14 })}
              ${t('list.modal.create', 'Create')}
            </button>
          </div>
        </div>
      </div>
    `

    const input = this.root.querySelector<HTMLInputElement>('[data-create-name]')!
    const submit = () => this.handleCreate(input)

    this.root.querySelector<HTMLButtonElement>('[data-action="create"]')!.addEventListener(
      'click',
      submit,
    )
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      }
    })

    this.gridEl = this.root.querySelector<HTMLElement>('[data-grid]')!
    this.mountGrid()
  }

  setDashboards(rows: DashboardRecord[]): void {
    this.ctx.dashboards = rows
    if (this.worksheets && this.worksheets[0]) {
      this.worksheets[0].setData(this.toGridData(rows))
    }
  }

  destroy(): void {
    if (this.gridEl) {
      try {
        jspreadsheet.destroy(this.gridEl as any)
      } catch {
        // already destroyed
      }
    }
    this.root.innerHTML = ''
  }

  // --- private ---

  private toGridData(rows: DashboardRecord[]): (string | number)[][] {
    return rows.map((r) => [
      r.dashboard_id,
      r.dashboard_name,
      r.survey_name ?? '',
      r.dashboard_updated ?? '',
    ])
  }

  private mountGrid(): void {
    if (!this.gridEl) return
    const t = (key: string, fallback: string) => this.ctx.dictionary?.[key] ?? fallback

    this.worksheets = jspreadsheet(this.gridEl, {
      worksheets: [
        {
          data: this.toGridData(this.ctx.dashboards),
          columns: [
            { type: 'numeric', title: t('list.col.id', 'ID'), width: 60, readOnly: true },
            { type: 'text', title: t('list.col.name', 'Name'), width: 280 },
            { type: 'text', title: t('list.col.survey', 'Survey'), width: 220, readOnly: true },
            { type: 'text', title: t('list.col.updated', 'Updated'), width: 160, readOnly: true },
          ],
          minDimensions: [4, 1],
          allowInsertRow: false,
          allowDeleteRow: false,
          allowInsertColumn: false,
          allowDeleteColumn: false,
          allowRenameColumn: false,
          columnSorting: true,
        },
      ],
      onselection: (_ws, x1, y1) => {
        // single-row click → emit onOpen
        if (x1 === 0 && typeof y1 === 'number') {
          const row = this.ctx.dashboards[y1]
          if (row) this.ctx.onOpen?.(row)
        }
      },
      contextMenu: ((_ws: any, _x: any, y: any, _e: any, items: any) => {
        if (typeof y !== 'number') return items
        const row = this.ctx.dashboards[y]
        if (!row) return items
        return [
          {
            title: t('list.open', 'Open'),
            onclick: () => this.ctx.onOpen?.(row),
          },
          { type: 'line' },
          {
            title: t('list.delete', 'Delete'),
            onclick: () => this.confirmDelete(row),
          },
        ]
      }) as any,
    })
  }

  private async handleCreate(input: HTMLInputElement): Promise<void> {
    const name = input.value.trim()
    if (!name) {
      input.focus()
      return
    }
    try {
      const created = this.ctx.api?.createDashboard
        ? await this.ctx.api.createDashboard({ dashboard_name: name })
        : this.localCreate(name)
      this.ctx.dashboards = [...this.ctx.dashboards, created]
      this.setDashboards(this.ctx.dashboards)
      this.ctx.onCreate?.(created)
      input.value = ''
      input.focus()
    } catch (e) {
      console.error('[dashjs] createDashboard failed', e)
    }
  }

  private localCreate(name: string): DashboardRecord {
    // Local-only fallback when no api.createDashboard is provided.
    const nextId = (this.ctx.dashboards.reduce((m, d) => Math.max(m, d.dashboard_id), 0) || 0) + 1
    return {
      dashboard_id: nextId,
      dashboard_name: name,
      dashboard_updated: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }
  }

  private async confirmDelete(row: DashboardRecord): Promise<void> {
    if (!confirm(`Delete "${row.dashboard_name}"?`)) return
    try {
      if (this.ctx.api?.deleteDashboard) {
        await this.ctx.api.deleteDashboard(row.dashboard_id)
      }
      this.ctx.dashboards = this.ctx.dashboards.filter((d) => d.dashboard_id !== row.dashboard_id)
      this.setDashboards(this.ctx.dashboards)
      this.ctx.onDelete?.(row.dashboard_id)
    } catch (e) {
      console.error('[dashjs] deleteDashboard failed', e)
    }
  }
}
