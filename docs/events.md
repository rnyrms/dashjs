title: Events
keywords: dashjs, events, callbacks, onSave, dashboard events, lifecycle hooks
description: Reference for the event callbacks exposed by Dashjs. Learn how to respond to save actions in the dashboard editor.
canonical: https://dashjs.com/docs/events

# Events

Dashjs exposes event callbacks via the `DashJsOptions` object. All callbacks are optional. Pass them at initialization to hook into user actions.


## Documentation

### Event callbacks

| Callback | Trigger | Arguments |
|----------|---------|-----------|
| `onSave` | The user clicks Save in the editor | `(dashboard: DashboardFull) => void \| Promise<void>` |

### DashboardFull (save event)

`onSave` receives a deep clone of the full dashboard state, including all pages, charts, controls, and filters:

```typescript
interface DashboardFull extends DashboardRecord {
  pages: DashboardPageRecord[]
  filters?: DashboardFilter[]
}
```

The `dashboard` passed to `onSave` is a deep clone — mutating it does not affect the live editor state.

`onSave` may return a `Promise` — useful for awaiting a network request to your backend.


## Examples

### Persist on save

```javascript
dashjs(element, {
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

### Save to local storage

```javascript
dashjs(element, {
  dashboard: JSON.parse(localStorage.getItem('my-dashboard') ?? 'null') ?? undefined,

  onSave: (dashboard) => {
    localStorage.setItem('my-dashboard', JSON.stringify(dashboard))
  },
})
```
