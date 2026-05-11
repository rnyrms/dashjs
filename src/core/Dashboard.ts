// Dashboard — the top-level controller. Dispatches by mode to the right page,
// owns lifecycle (mount/destroy), and exposes the public instance API.

import { DashboardList } from './pages/DashboardList'
import { DashboardViewer } from './pages/DashboardViewer'
import { DashboardEditor } from './pages/DashboardEditor'
import type { DashJsMode, DashJsOptions, DashJsInstance } from './types'
import type { DashboardRecord } from './domain'

type Page = { destroy(): void; setDashboards?: (rows: DashboardRecord[]) => void } | null

export class Dashboard {
  private root: HTMLElement
  private options: DashJsOptions
  private mode: DashJsMode
  private dashboards: DashboardRecord[]
  private page: Page = null

  constructor(root: HTMLElement, options: DashJsOptions) {
    this.root = root
    this.options = options
    this.mode = options.mode ?? 'list'
    this.dashboards = options.dashboards ?? []

    // Mark the root so our scoped CSS applies.
    this.root.setAttribute('data-dashjs', '')
    if (options.theme) this.root.setAttribute('data-dashjs-theme', options.theme)

    this.mount()
  }

  api(): DashJsInstance {
    return {
      setMode: (mode) => {
        if (mode === this.mode) return
        this.mode = mode
        this.remount()
      },
      getMode: () => this.mode,
      setDashboards: (rows) => {
        this.dashboards = rows
        this.page?.setDashboards?.(rows)
      },
      destroy: () => {
        this.page?.destroy()
        this.page = null
        this.root.removeAttribute('data-dashjs')
        this.root.removeAttribute('data-dashjs-theme')
        this.root.innerHTML = ''
      },
    }
  }

  private mount(): void {
    switch (this.mode) {
      case 'list': {
        const list = new DashboardList(this.root, {
          dashboards: this.dashboards,
          api: this.options.api,
          dictionary: this.options.dictionary,
          onCreate: this.options.onCreate,
          onOpen: this.options.onOpen,
          onDelete: this.options.onDelete,
        })
        list.render()
        this.page = list
        break
      }
      case 'viewer': {
        const viewer = new DashboardViewer(this.root, {
          dashboard: this.options.dashboard ?? defaultDashboard(),
          dictionary: this.options.dictionary,
        })
        viewer.render()
        this.page = viewer
        break
      }
      case 'editor': {
        const editor = new DashboardEditor(this.root, {
          dashboard: this.options.dashboard ?? defaultDashboard(),
          dictionary: this.options.dictionary,
          onSave: this.options.onSave,
          dataSource: this.options.dataSource,
        })
        editor.render()
        this.page = editor
        break
      }
      default:
        this.root.innerHTML = `<div class="dashjs-empty">Mode "${this.mode}" not yet implemented in this phase.</div>`
        this.page = { destroy: () => {} }
    }
  }

  private remount(): void {
    this.page?.destroy()
    this.mount()
  }
}

function defaultDashboard() {
  return {
    dashboard_id: 1,
    dashboard_name: 'Q1 Customer Satisfaction',
    survey_name: 'CSAT 2026',
    dashboard_updated: '2026-04-21 14:32',
    pages: [],
  }
}
