// CSV parser + simple field-type inference used by the editor's "Upload CSV"
// action. Self-contained — no dependency on the broader dashjs surface so it
// can be unit-tested in isolation.

import type { DataField, FieldType } from '../types'

export interface CsvParseResult {
  fields: DataField[]
  rows: Record<string, string>[]
}

/**
 * Parse a CSV string with a header row. Supports double-quoted values with
 * embedded commas, newlines, and escaped quotes ("") in the RFC-4180 style.
 * Rows shorter than the header are padded with empty strings.
 */
export function parseCsv(text: string): CsvParseResult {
  const cells = tokenizeCsv(text)
  if (cells.length === 0) return { fields: [], rows: [] }
  const headers = cells[0].map((h, i) => (h && h.trim()) || `column_${i + 1}`)
  const rows = cells.slice(1)
    .filter((r) => r.some((v) => v !== ''))
    .map((cols) => {
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = cols[i] ?? '' })
      return row
    })
  const fields: DataField[] = headers.map((h) => ({
    id: h,
    name: h,
    type: inferFieldType(rows.map((r) => r[h])),
  }))
  return { fields, rows }
}

/** Sniff a column's type from its sampled values. */
function inferFieldType(values: string[]): FieldType {
  const nonEmpty = values.filter((v) => v && v.trim() !== '')
  if (nonEmpty.length === 0) return 'text'
  if (nonEmpty.every((v) => !isNaN(Number(v)) && v.trim() !== '')) return 'numeric'
  if (nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) return 'date'
  const unique = new Set(nonEmpty)
  // Low-cardinality columns are best treated as categorical single-select.
  if (unique.size < Math.max(20, nonEmpty.length / 3)) return 'single'
  return 'text'
}

/**
 * Tokenise CSV text into a 2D array of cells. Walks the string once,
 * tracking whether we're inside a quoted field. Recognises CR / LF / CRLF
 * line endings and double-quote escapes.
 */
function tokenizeCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { cur += ch }
    } else {
      if (ch === '"' && cur === '') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(cur); cur = ''
      } else if (ch === '\r') {
        // swallow — let the \n handle the row push (or treat lone \r as newline)
        if (text[i + 1] !== '\n') {
          row.push(cur); cur = ''
          rows.push(row); row = []
        }
      } else if (ch === '\n') {
        row.push(cur); cur = ''
        rows.push(row); row = []
      } else {
        cur += ch
      }
    }
  }
  // Flush trailing cell / row.
  if (cur !== '' || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}
