// Dashboard — the top-level controller. Owns lifecycle (mount/destroy) of
// the editor and exposes the public instance API.

import { DashboardEditor } from './pages/DashboardEditor'
import type { DashJsOptions, DashJsInstance } from './types'
import type { DashboardFull } from './domain'

export class Dashboard {
  private root: HTMLElement
  private editor: DashboardEditor

  constructor(root: HTMLElement, options: DashJsOptions) {
    this.root = root

    // Mark the root so our scoped CSS applies.
    this.root.setAttribute('data-dashjs', '')
    if (options.theme) this.root.setAttribute('data-dashjs-theme', options.theme)

    this.editor = new DashboardEditor(this.root, {
      dashboard: options.dashboard ?? emptyDashboard(),
      dictionary: options.dictionary,
      onSave: options.onSave,
      dataSource: options.dataSource,
    })
    this.editor.render()
  }

  api(): DashJsInstance {
    return {
      destroy: () => {
        this.editor.destroy()
        this.root.removeAttribute('data-dashjs')
        this.root.removeAttribute('data-dashjs-theme')
        this.root.innerHTML = ''
      },
    }
  }
}

function emptyDashboard(): DashboardFull {
  return {
    dashboard_id: 0,
    dashboard_name: 'Untitled dashboard',
    pages: [],
  }
}
