// Lucide icon helper — vanilla, no React.
// Returns an SVG string we can drop into Lemonade templates as raw HTML.

import {
  Plus,
  Trash2,
  Pencil,
  Eye,
  Search,
  Settings,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  X,
  Save,
  Share2,
  Sun,
  Moon,
  ArrowLeft,
  Undo2,
  Redo2,
  MousePointer2,
  ChevronsLeft,
  ChevronsRight,
  Database,
  BarChart3,
  Filter,
  Type,
  Image,
  Shapes,
  Code2,
  Minus,
  Palette,
  RotateCcw,
  MoreVertical,
  CalendarDays,
  type IconNode,
} from 'lucide'

export type IconName =
  | 'plus'
  | 'trash'
  | 'pencil'
  | 'eye'
  | 'search'
  | 'settings'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'x'
  | 'save'
  | 'share'
  | 'sun'
  | 'moon'
  | 'arrow-left'
  | 'undo'
  | 'redo'
  | 'cursor'
  | 'chevrons-left'
  | 'chevrons-right'
  | 'database'
  | 'chart'
  | 'filter'
  | 'text'
  | 'image'
  | 'shapes'
  | 'code'
  | 'line'
  | 'palette'
  | 'reset'
  | 'more'
  | 'calendar'

const ICONS: Record<IconName, IconNode> = {
  plus: Plus,
  trash: Trash2,
  pencil: Pencil,
  eye: Eye,
  search: Search,
  settings: Settings,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  x: X,
  save: Save,
  share: Share2,
  sun: Sun,
  moon: Moon,
  'arrow-left': ArrowLeft,
  undo: Undo2,
  redo: Redo2,
  cursor: MousePointer2,
  'chevrons-left': ChevronsLeft,
  'chevrons-right': ChevronsRight,
  database: Database,
  chart: BarChart3,
  filter: Filter,
  text: Type,
  image: Image,
  shapes: Shapes,
  code: Code2,
  line: Minus,
  palette: Palette,
  reset: RotateCcw,
  more: MoreVertical,
  calendar: CalendarDays,
}

/**
 * Render a Lucide icon as an SVG string.
 * Lucide IconNode shape: [tag, attrs, children?]
 */
export function icon(name: IconName, options: { size?: number; class?: string } = {}): string {
  const node = ICONS[name]
  if (!node) return ''
  const size = options.size ?? 16
  const [, baseAttrs, children = []] = node

  // Merge size + class into the base svg attrs.
  const merged: Record<string, string | number> = { ...baseAttrs, width: size, height: size }
  if (options.class) merged.class = options.class

  return `<svg ${attrsToString(merged)}>${children.map(renderChild).join('')}</svg>`
}

function renderChild(child: readonly [string, Record<string, string | number>]): string {
  const [tag, attrs] = child
  return `<${tag} ${attrsToString(attrs)} />`
}

function attrsToString(attrs: Record<string, string | number>): string {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
    .join(' ')
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
