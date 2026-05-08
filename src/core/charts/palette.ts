// Default chart palette — used when ChartConfig.colors.palette is empty.
// Same hues as tabularpro for visual continuity.

export const DEFAULT_PALETTE = [
  '#2383E2',
  '#6940A5',
  '#D44C47',
  '#CB7B37',
  '#448361',
  '#337EA9',
  '#9065B0',
  '#C14C8A',
]

export function paletteFor(config?: { colors?: { palette?: string[] } }): string[] {
  const p = config?.colors?.palette
  return p && p.length ? p : DEFAULT_PALETTE
}
