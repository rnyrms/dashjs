// Internal types for the dashjs core (not domain types — see ./domain.ts).

import type { DashboardRecord, DashboardFull } from './domain'

export type DashJsMode = 'list' | 'editor' | 'viewer' | 'public' | 'auth'

/** Subset of REST methods the dashboard reaches for. Replace with your own. */
export interface DashJsApi {
  listDashboards: () => Promise<DashboardRecord[]>
  createDashboard: (data: { dashboard_name: string; survey_id?: number }) => Promise<DashboardRecord>
  deleteDashboard: (id: number) => Promise<void>
  // builder/viewer endpoints come in later phases
}

export interface DashJsOptions {
  mode?: DashJsMode
  /** Pre-fetched dashboards to render in `list` mode without an API. */
  dashboards?: DashboardRecord[]
  /** Single dashboard to render in `viewer` mode. */
  dashboard?: DashboardFull
  /** API adapter — if omitted in list mode, dashjs renders `dashboards` as a static list. */
  api?: Partial<DashJsApi>
  /** Override theme (light is default). */
  theme?: 'light' | 'dark'
  /** i18n dictionary; missing keys fall back to the English literal. */
  dictionary?: Record<string, string>
  /** Called after the user creates a dashboard from the list page. */
  onCreate?: (dashboard: DashboardRecord) => void
  /** Called when the user clicks a dashboard row to open it. */
  onOpen?: (dashboard: DashboardRecord) => void
  /** Called after a dashboard is deleted. */
  onDelete?: (id: number) => void
  /** Called when the user explicitly saves in editor mode. Receives a deep clone. */
  onSave?: (dashboard: DashboardFull) => void | Promise<void>
}

export interface DashJsInstance {
  setMode: (mode: DashJsMode) => void
  getMode: () => DashJsMode
  setDashboards: (rows: DashboardRecord[]) => void
  destroy: () => void
}
