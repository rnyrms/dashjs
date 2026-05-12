// Control widgets — interactive filter inputs that live on the same
// gridstack canvas as charts. Each control type renders a small widget
// that, when changed, emits a DashboardFilter into the dashboard's
// global filter list. v1 ships dropdown / multiselect / daterange.

import jSuites from 'jsuites'
import type { ControlType, DashboardControlRecord, DashboardFilter } from '../domain'

export interface ControlHandle {
  destroy: () => void
}

export interface ControlRenderContext {
  /** All distinct values available for the control's bound field. Sourced
   *  from CSV rows when uploaded, else an empty list. */
  options: string[]
  /** Called when the user changes the control's value. Receives the new
   *  selection (single string for dropdown, multiple for multiselect). */
  onChange: (selectedValues: string[]) => void
}

export function renderControl(
  el: HTMLElement,
  control: DashboardControlRecord,
  ctx: ControlRenderContext,
): ControlHandle {
  el.innerHTML = ''
  switch (control.dashboard_control_type) {
    case 'dropdown':    return renderDropdown(el, control, ctx)
    case 'multiselect': return renderMultiselect(el, control, ctx)
    case 'daterange':   return renderDateRange(el, control, ctx)
    default: {
      el.innerHTML = `<div class="dashjs-chart__placeholder">Control type "${control.dashboard_control_type}" not implemented</div>`
      return { destroy: () => { el.innerHTML = '' } }
    }
  }
}

function renderDropdown(
  el: HTMLElement,
  control: DashboardControlRecord,
  ctx: ControlRenderContext,
): ControlHandle {
  const cfg = control.dashboard_control_config ?? {}
  const selected = cfg.selectedValues?.[0] ?? ''
  const fieldName = cfg.field?.name ?? '(no field)'

  const wrap = document.createElement('div')
  wrap.className = 'dashjs-control__body dashjs-control__body--dropdown'
  wrap.innerHTML = `
    <div class="dashjs-control__field">${escapeHtml(fieldName)}</div>
    <select class="dashjs-control__select">
      <option value="">(All)</option>
      ${ctx.options.map((v) => `<option value="${escapeHtml(v)}" ${v === selected ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
    </select>
  `
  el.appendChild(wrap)

  const select = wrap.querySelector<HTMLSelectElement>('select')!
  const onSelectChange = () => {
    const v = select.value
    ctx.onChange(v ? [v] : [])
  }
  select.addEventListener('change', onSelectChange)
  // Stop click bubbling so selecting an option doesn't also deselect the card.
  select.addEventListener('click', (e) => e.stopPropagation())

  return {
    destroy: () => {
      select.removeEventListener('change', onSelectChange)
      el.innerHTML = ''
    },
  }
}

function renderMultiselect(
  el: HTMLElement,
  control: DashboardControlRecord,
  ctx: ControlRenderContext,
): ControlHandle {
  const cfg = control.dashboard_control_config ?? {}
  const selected = new Set(cfg.selectedValues ?? [])
  const fieldName = cfg.field?.name ?? '(no field)'

  const wrap = document.createElement('div')
  wrap.className = 'dashjs-control__body dashjs-control__body--multiselect'
  wrap.innerHTML = `
    <div class="dashjs-control__field">${escapeHtml(fieldName)}</div>
    <div class="dashjs-control__list">
      ${ctx.options.map((v) => `
        <label class="dashjs-control__checkbox">
          <input type="checkbox" value="${escapeHtml(v)}" ${selected.has(v) ? 'checked' : ''} />
          <span>${escapeHtml(v)}</span>
        </label>
      `).join('') || '<div class="dashjs-control__empty">No values available</div>'}
    </div>
  `
  el.appendChild(wrap)

  const checkboxes = wrap.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
  const onChange = () => {
    const values = Array.from(checkboxes)
      .filter((c) => c.checked)
      .map((c) => c.value)
    ctx.onChange(values)
  }
  checkboxes.forEach((c) => {
    c.addEventListener('change', onChange)
    c.addEventListener('click', (e) => e.stopPropagation())
  })

  return {
    destroy: () => {
      checkboxes.forEach((c) => c.removeEventListener('change', onChange))
      el.innerHTML = ''
    },
  }
}

function renderDateRange(
  el: HTMLElement,
  control: DashboardControlRecord,
  ctx: ControlRenderContext,
): ControlHandle {
  const cfg = control.dashboard_control_config ?? {}
  const [start = '', end = ''] = cfg.selectedValues ?? []
  const fieldName = cfg.field?.name ?? '(no field)'

  const wrap = document.createElement('div')
  wrap.className = 'dashjs-control__body dashjs-control__body--daterange'
  wrap.innerHTML = `
    <div class="dashjs-control__field">${escapeHtml(fieldName)}</div>
    <div class="dashjs-control__daterow">
      <input type="text" class="dashjs-control__date" data-bound="start" value="${escapeHtml(start)}" placeholder="Start" readonly />
      <span class="dashjs-control__daterow-sep">→</span>
      <input type="text" class="dashjs-control__date" data-bound="end" value="${escapeHtml(end)}" placeholder="End" readonly />
    </div>
  `
  el.appendChild(wrap)

  const startEl = wrap.querySelector<HTMLInputElement>('[data-bound="start"]')!
  const endEl = wrap.querySelector<HTMLInputElement>('[data-bound="end"]')!

  const emit = () => {
    const s = startEl.value
    const e = endEl.value
    ctx.onChange(!s && !e ? [] : [s, e])
  }

  // jSuites.calendar attaches a popover picker to each input. `onclose`
  // fires after the user picks a date (or closes the popover), at which
  // point we emit the filter update.
  let startCal: any, endCal: any
  try {
    // jSuites Options is strictly typed but most fields are optional in
    // practice — cast the option literal to satisfy the compiler.
    startCal = jSuites.calendar(startEl, { format: 'YYYY-MM-DD', value: start, onclose: emit } as any)
    endCal = jSuites.calendar(endEl, { format: 'YYYY-MM-DD', value: end, onclose: emit } as any)
  } catch (err) {
    console.error('[dashjs] daterange calendar init failed', err)
  }

  // Stop click bubbling so opening the calendar doesn't deselect the card.
  ;[startEl, endEl].forEach((input) => input.addEventListener('click', (e) => e.stopPropagation()))

  return {
    destroy: () => {
      try { startCal?.close?.() } catch { /* ignore */ }
      try { endCal?.close?.() } catch { /* ignore */ }
      wrap.remove()
    },
  }
}

/** Factory for a fresh control of the given type, positioned on the page. */
export function createDefaultControl(
  type: ControlType,
  id: number,
  position: { pageId: number; x: number; y: number },
): DashboardControlRecord {
  const base = {
    dashboard_control_id: id,
    dashboard_page_id: position.pageId,
    dashboard_control_x: position.x,
    dashboard_control_y: position.y,
  }
  switch (type) {
    case 'dropdown':
      return {
        ...base,
        dashboard_control_type: 'dropdown',
        dashboard_control_title: 'Dropdown',
        dashboard_control_w: 4,
        dashboard_control_h: 2,
        dashboard_control_config: {},
      }
    case 'multiselect':
      return {
        ...base,
        dashboard_control_type: 'multiselect',
        dashboard_control_title: 'Multi-select',
        dashboard_control_w: 4,
        dashboard_control_h: 4,
        dashboard_control_config: {},
      }
    case 'daterange':
      return {
        ...base,
        dashboard_control_type: 'daterange',
        dashboard_control_title: 'Date range',
        dashboard_control_w: 5,
        dashboard_control_h: 2,
        dashboard_control_config: {},
      }
    default:
      return {
        ...base,
        dashboard_control_type: type,
        dashboard_control_title: type,
        dashboard_control_w: 4,
        dashboard_control_h: 2,
        dashboard_control_config: {},
      }
  }
}

/** Build the dashboard filter that a control with the given selection
 *  should emit. Returns null when no value is selected (the caller should
 *  drop any existing filter row for this control). */
export function controlToFilter(
  control: DashboardControlRecord,
  selectedValues: string[],
): DashboardFilter | null {
  const field = control.dashboard_control_config?.field
  if (!field || selectedValues.length === 0) return null
  const operator = control.dashboard_control_type === 'multiselect' ? 'in'
    : control.dashboard_control_type === 'daterange' ? 'between'
    : 'eq'
  return {
    id: 'ctl' + control.dashboard_control_id,
    controlId: control.dashboard_control_id,
    fieldId: field.id,
    fieldName: field.name,
    operator,
    values: selectedValues,
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
