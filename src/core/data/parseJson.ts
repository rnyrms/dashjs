// Parse Jspreadsheet JSON output into dashjs CsvParseResult.
// Supports both formats the spreadsheet API can emit:
//   - Array of objects  → worksheet.getJson()
//   - 2-D array         → worksheet.getData()  (first row treated as headers)

import type { CsvParseResult } from '../charts/csv'
import { inferFieldType } from '../charts/csv'
import type { DataField } from '../types'

export function parseJspreadsheetJson(text: string): CsvParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.trim())
  } catch {
    return { fields: [], rows: [] }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return { fields: [], rows: [] }

  if (Array.isArray(parsed[0])) {
    return parse2dArray(parsed as unknown[][])
  }
  if (typeof parsed[0] === 'object' && parsed[0] !== null) {
    return parseObjectArray(parsed as Record<string, unknown>[])
  }

  return { fields: [], rows: [] }
}

function parseObjectArray(data: Record<string, unknown>[]): CsvParseResult {
  const headers = Object.keys(data[0])
  if (headers.length === 0) return { fields: [], rows: [] }

  const rows = data.map((r) => {
    const row: Record<string, string> = {}
    for (const h of headers) row[h] = String(r[h] ?? '')
    return row
  })
  const fields: DataField[] = headers.map((h) => ({
    id: h,
    name: h,
    type: inferFieldType(rows.map((r) => r[h])),
  }))
  return { fields, rows }
}

function parse2dArray(data: unknown[][]): CsvParseResult {
  if (data.length < 2) return { fields: [], rows: [] }

  const headers = (data[0] as unknown[]).map((h, i) =>
    h !== null && h !== undefined && String(h).trim() !== ''
      ? String(h).trim()
      : `column_${i + 1}`,
  )

  const rows = (data.slice(1) as unknown[][])
    .filter((cols) => cols.some((v) => v !== null && v !== undefined && String(v).trim() !== ''))
    .map((cols) => {
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = String((cols as unknown[])[i] ?? '') })
      return row
    })

  const fields: DataField[] = headers.map((h) => ({
    id: h,
    name: h,
    type: inferFieldType(rows.map((r) => r[h])),
  }))
  return { fields, rows }
}
