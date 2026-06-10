// TabularJS wrapper — converts Excel, ODS, TSV, DIF, DBF, SLK, HTML tables
// and other formats into the internal CsvParseResult that dashjs uses.
// TabularJS returns a Jspreadsheet-compatible Worksheet with a 2-D `data`
// array and a `columns` metadata array.

import tabularjs from 'tabularjs'
import type { CsvParseResult } from '../charts/csv'
import { inferFieldType } from '../charts/csv'
import type { DataField } from '../types'

export async function parseTabularFile(file: File): Promise<CsvParseResult> {
  let parsed
  try {
    parsed = await tabularjs(file)
  } catch (err) {
    console.error('[dashjs] tabularjs failed for', file.name, err)
    return { fields: [], rows: [] }
  }
  const result = parsed
  const ws = result.worksheets[0]
  if (!ws?.data || ws.data.length === 0) return { fields: [], rows: [] }

  // TabularJS may set column.name when it detects a named header row; fall
  // back to the first data row as headers otherwise.
  const hasNamedCols =
    Array.isArray(ws.columns) &&
    ws.columns.length > 0 &&
    ws.columns.some((c) => c.name && c.name.trim() !== '')

  let headers: string[]
  let dataRows: unknown[][]

  if (hasNamedCols) {
    headers = ws.columns.map((c, i) =>
      (c.name ?? c.title ?? '').trim() || `column_${i + 1}`,
    )
    dataRows = ws.data
  } else {
    headers = (ws.data[0] as unknown[]).map((h, i) =>
      h !== null && h !== undefined && String(h).trim() !== ''
        ? String(h).trim()
        : `column_${i + 1}`,
    )
    dataRows = ws.data.slice(1)
  }

  const rows = dataRows
    .filter((cols) =>
      (cols as unknown[]).some(
        (v) => v !== null && v !== undefined && String(v).trim() !== '',
      ),
    )
    .map((cols) => {
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = String((cols as unknown[])[i] ?? '') })
      return row
    })

  const fields: DataField[] = headers.map((h, i) => {
    const colType = ws.columns?.[i]?.type
    let type = inferFieldType(rows.map((r) => r[h]))
    if (colType === 'numeric' && type === 'text') type = 'numeric'
    if (colType === 'calendar' && type === 'text') type = 'date'
    return { id: h, name: h, type }
  })

  return { fields, rows }
}

/** File extensions that TabularJS handles (beyond CSV/JSON which we parse directly). */
export const TABULAR_EXTENSIONS = new Set([
  'xlsx', 'xls', 'ods', 'tsv', 'dif', 'dbf', 'slk', 'wks', 'xml',
])
