// Public API for dashjs — framework-agnostic dashboard component.
//
// Usage (vanilla):
//   import dashjs from 'dashjs'
//   import 'dashjs/styles'
//   const instance = dashjs(document.getElementById('app'), { mode: 'list' })
//
// The factory returns an instance you can drive imperatively. No framework
// dependency on the consumer side — works from React, Vue, Svelte, or plain
// HTML the same way.

import jspreadsheet from 'jspreadsheet'
import { Dashboard } from './core/Dashboard'
import type { DashJsOptions, DashJsInstance } from './core/types'

// Set the Jspreadsheet license at module load — must happen before any
// worksheet renders. Consumers can call dashjs.setLicense(key) to override.
jspreadsheet.setLicense('evaluation')

export type {
  DashJsOptions,
  DashJsInstance,
  DashJsMode,
  DashJsDataSource,
  DataField,
  FieldType,
} from './core/types'
export type {
  DashboardRecord,
  DashboardFull,
  DashboardChartRecord,
  DashboardPageRecord,
  DashboardFilter,
  ChartConfig,
  ChartDataPoint,
  ChartDataSeries,
  ChartType,
  FilterOperator,
} from './core/domain'

function dashjs(element: HTMLElement, options: DashJsOptions = {}): DashJsInstance {
  const dashboard = new Dashboard(element, options)
  return dashboard.api()
}

// Static helpers — mirror Jspreadsheet's pattern.
dashjs.version = '0.2.0'
dashjs.setLicense = (key: string) => jspreadsheet.setLicense(key)

export default dashjs
