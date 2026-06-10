title: Events
keywords: dashjs, events, callbacks, onCreate, onOpen, onDelete, onSave, dashboard events, lifecycle hooks
description: Reference for all event callbacks exposed by Dashjs. Learn how to respond to dashboard creation, opening, deletion, and save actions.
canonical: https://dashjs.com/docs/events

# Events

Dashjs exposes event callbacks via the `DashJsOptions` object. All callbacks are optional. Pass them at initialization to hook into user actions and lifecycle transitions.


## Documentation

### Event callbacks

| Callback | Trigger | Arguments |
|----------|---------|-----------|
| `onCreate` | The user creates a new dashboard from the list page | `(dashboard: DashboardRecord) => void` |
| `onOpen` | The user clicks a dashboard row in the list | `(dashboard: DashboardRecord) => void` |
| `onDelete` | The user deletes a dashboard (after confirmation) | `(id: number) => void` |
| `onSave` | The user clicks Save in the editor | `(dashboard: DashboardFull) => void \| Promise<void>` |

### DashboardRecord (list events)

```typescript
interface DashboardRecord {
  dashboard_id: number
  dashboard_name: string
  dashboard_description?: string
  dashboard_slug?: string
  survey_id?: number
  survey_name?: string
  workspace_id?: number
  dashboard_settings?: Record<string, unknown>
  dashboard_inserted?: string
  dashboard_updated?: string
}
```

### DashboardFull (save event)

`onSave` receives a deep clone of the full dashboard state, including all pages, charts, controls, and filters:

```typescript
interface DashboardFull extends DashboardRecord {
  pages: DashboardPageRecord[]
  filters?: DashboardFilter[]
}
```

The `dashboard` passed to `onSave` is a deep clone — mutating it does not affect the live editor state.


## Examples

### Handle list navigation

```javascript
const instance = dashjs(document.getElementById('app'), {
  mode: 'list',
  dashboards: myDashboards,

  onCreate: (dashboard) => {
    console.log('Created:', dashboard.dashboard_id)
    // Switch to editor immediately after creation
    instance.setMode('editor')
  },

  onOpen: (dashboard) => {
    // Fetch the full dashboard from your API, then switch modes.
    fetch(`/api/dashboards/${dashboard.dashboard_id}`)
      .then(r => r.json())
      .then(full => {
        instance.setMode('editor')
      })
  },

  onDelete: (id) => {
    console.log('Deleted dashboard', id)
  },
})
```

### Persist on save

```javascript
dashjs(element, {
  mode: 'editor',
  dashboard: myDashboard,

  onSave: async (dashboard) => {
    const res = await fetch(`/api/dashboards/${dashboard.dashboard_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dashboard),
    })

    if (!res.ok) {
      alert('Save failed — please try again.')
    }
  },
})
```

### Use with API adapter

When `options.api` is provided, the list page calls it for create/delete operations automatically. `onCreate` and `onDelete` fire after those operations complete.

```javascript
dashjs(element, {
  mode: 'list',

  api: {
    listDashboards: () => fetch('/api/dashboards').then(r => r.json()),
    createDashboard: (data) =>
      fetch('/api/dashboards', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(r => r.json()),
    deleteDashboard: (id) =>
      fetch(`/api/dashboards/${id}`, { method: 'DELETE' }).then(r => r.json()),
  },

  onCreate: (dashboard) => {
    console.log('New dashboard created with ID', dashboard.dashboard_id)
  },

  onDelete: (id) => {
    console.log('Dashboard', id, 'deleted')
  },
})
```

### DashJsApi interface

```typescript
interface DashJsApi {
  listDashboards:    () => Promise<DashboardRecord[]>
  createDashboard:   (data: { dashboard_name: string; survey_id?: number }) => Promise<DashboardRecord>
  deleteDashboard:   (id: number) => Promise<void>
}
```

All methods are optional — pass only the ones your backend supports.
