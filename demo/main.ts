import dashjs from '../src/index'
import { MOCK_DASHBOARD } from '../src/core/mockData'

const root = document.getElementById('app')!

const instance = dashjs(root, {
  mode: 'editor',
  dashboard: MOCK_DASHBOARD,
})

// Light/dark toggle in the demo header.
const themeBtn = document.getElementById('theme-toggle')!
let theme: 'light' | 'dark' = 'light'
themeBtn.addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light'
  root.setAttribute('data-dashjs-theme', theme)
})

// Mode toggle for editor ↔ viewer comparison.
const modeBtn = document.getElementById('mode-toggle')
let mode: 'editor' | 'viewer' = 'editor'
modeBtn?.addEventListener('click', () => {
  mode = mode === 'editor' ? 'viewer' : 'editor'
  instance.setMode(mode)
  modeBtn.textContent = mode === 'editor' ? 'Switch to view mode' : 'Switch to edit mode'
})

;(window as any).dashjs = { instance, dashjs }
