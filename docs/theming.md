title: Theming
keywords: dashjs, theming, dark mode, CSS variables, custom properties, styling, CSS scoping, color palette
description: Customize the Dashjs visual appearance using CSS custom properties. Learn how to enable dark mode, override the color scheme, and safely extend the component's styles.
canonical: https://dashjs.com/docs/theming

# Theming

Dashjs styles are scoped to the `[data-dashjs]` attribute added automatically to the container element. All visual tokens are CSS custom properties defined on that selector, making it straightforward to override the entire color scheme from your own stylesheet.


## Documentation

### CSS custom properties

Override any of these properties on `[data-dashjs]` to change the global visual appearance:

| Property | Default (light) | Description |
|----------|-----------------|-------------|
| `--dashjs-bg` | `#ffffff` | Main background |
| `--dashjs-bg-subtle` | `#f6f6f5` | Subtle background (panels, sidebars) |
| `--dashjs-bg-hover` | `#efefef` | Hover state background |
| `--dashjs-border` | `#e6e6e5` | Border color |
| `--dashjs-text` | `#1a1a1a` | Primary text |
| `--dashjs-text-muted` | `#8a8a8a` | Secondary / muted text |
| `--dashjs-accent` | `#2383e2` | Action color (buttons, active states) |
| `--dashjs-accent-hover` | `#1a6dc1` | Action color hover |
| `--dashjs-danger` | `#d44c47` | Destructive actions |
| `--dashjs-radius` | `6px` | Border radius |
| `--dashjs-spacing` | `12px` | Base spacing unit |

### Dark mode

Pass `theme: 'dark'` to the factory function:

```javascript
dashjs(element, { theme: 'dark' })
```

This sets `data-dashjs-theme="dark"` on the container. The dark theme redefines all custom properties:

| Property | Dark value |
|----------|------------|
| `--dashjs-bg` | `#191919` |
| `--dashjs-bg-subtle` | `#252525` |
| `--dashjs-bg-hover` | `#2f2f2f` |
| `--dashjs-border` | `#383838` |
| `--dashjs-text` | `#e8e8e8` |
| `--dashjs-text-muted` | `#666666` |
| `--dashjs-accent` | `#2383e2` |
| `--dashjs-accent-hover` | `#1a6dc1` |
| `--dashjs-danger` | `#d44c47` |

Switching theme at runtime:

```javascript
const instance = dashjs(element, { mode: 'editor' })

// Toggle dark mode
element.setAttribute('data-dashjs-theme', 'dark')

// Remove theme override (revert to light)
element.removeAttribute('data-dashjs-theme')
```

### CSS scoping

All Dashjs styles are prefixed with `[data-dashjs]` so they cannot leak into the rest of the page. When you need to override a component style, follow the same pattern:

```css
/* Override the sidebar background */
[data-dashjs] .dashjs-sidebar {
  --dashjs-bg-subtle: #f0f4ff;
}

/* Target only dark mode */
[data-dashjs-theme="dark"] .dashjs-chart-slot {
  border-color: #4a4a4a;
}
```

Modals and overlays appended to `document.body` outside the container receive the `data-dashjs` attribute explicitly and copy the `data-dashjs-theme` value so they inherit all custom properties.


## Examples

### Custom brand colors

```css
#my-dashboard[data-dashjs] {
  --dashjs-accent:       #7c3aed;
  --dashjs-accent-hover: #6d28d9;
  --dashjs-danger:       #dc2626;
}
```

```javascript
dashjs(document.getElementById('my-dashboard'), { mode: 'editor' })
```

### Fully custom theme (both modes)

```css
[data-dashjs] {
  --dashjs-bg:          #fafafa;
  --dashjs-bg-subtle:   #f0f0f0;
  --dashjs-bg-hover:    #e8e8e8;
  --dashjs-border:      #d0d0d0;
  --dashjs-text:        #111111;
  --dashjs-text-muted:  #777777;
  --dashjs-accent:      #0066cc;
  --dashjs-accent-hover:#0052a3;
  --dashjs-danger:      #cc3300;
  --dashjs-radius:      4px;
  --dashjs-spacing:     10px;
}

[data-dashjs-theme="dark"] {
  --dashjs-bg:          #0d0d0d;
  --dashjs-bg-subtle:   #1a1a1a;
  --dashjs-bg-hover:    #262626;
  --dashjs-border:      #333333;
  --dashjs-text:        #f0f0f0;
  --dashjs-text-muted:  #777777;
}
```

### Compact spacing

```css
[data-dashjs] {
  --dashjs-spacing: 8px;
  --dashjs-radius:  3px;
}
```


## Chart color palettes

Chart series colors are separate from the UI theme. The default palette is:

```javascript
['#2383E2', '#6940A5', '#D44C47', '#CB7B37', '#448361', '#337EA9', '#9065B0', '#C14C8A']
```

Override per chart via `ChartConfig.colors.palette`. See [Chart Types](/docs/chart-types) for details.
