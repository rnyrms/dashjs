import { describe, it, expect } from 'vitest'
import { parseJspreadsheetJson } from './parseJson'

// ─── array-of-objects format (worksheet.getJson()) ────────────────────────────

describe('parseJspreadsheetJson — array of objects', () => {
  it('parses a basic object array', () => {
    const json = JSON.stringify([
      { Category: 'A', Revenue: 100 },
      { Category: 'B', Revenue: 200 },
    ])
    const result = parseJspreadsheetJson(json)
    expect(result.fields).toHaveLength(2)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ Category: 'A', Revenue: '100' })
  })

  it('infers numeric type for number columns', () => {
    // Need > 20 unique names so inferFieldType doesn't classify Name as 'single'.
    const rows = Array.from({ length: 25 }, (_, i) => ({ Name: `Person_${i}`, Score: i * 10 }))
    const { fields } = parseJspreadsheetJson(JSON.stringify(rows))
    expect(fields.find(f => f.id === 'Score')?.type).toBe('numeric')
    expect(fields.find(f => f.id === 'Name')?.type).toBe('text')
  })

  it('infers date type for ISO date columns', () => {
    const json = JSON.stringify([
      { Date: '2024-01-01', Value: '10' },
      { Date: '2024-06-15', Value: '20' },
    ])
    const { fields } = parseJspreadsheetJson(json)
    expect(fields.find(f => f.id === 'Date')?.type).toBe('date')
  })

  it('infers single type for low-cardinality columns', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      Cat: ['A', 'B', 'C', 'D', 'E'][i % 5],
    }))
    const { fields } = parseJspreadsheetJson(JSON.stringify(rows))
    expect(fields[0].type).toBe('single')
  })

  it('coerces non-string values to string in rows', () => {
    const json = JSON.stringify([{ Active: true, Count: 42, Label: null }])
    const { rows } = parseJspreadsheetJson(json)
    expect(rows[0].Active).toBe('true')
    expect(rows[0].Count).toBe('42')
    expect(rows[0].Label).toBe('')
  })

  it('sets id and name equal to the key', () => {
    const json = JSON.stringify([{ revenue: 10 }])
    const { fields } = parseJspreadsheetJson(json)
    expect(fields[0].id).toBe('revenue')
    expect(fields[0].name).toBe('revenue')
  })
})

// ─── 2-D array format (worksheet.getData()) ───────────────────────────────────

describe('parseJspreadsheetJson — 2-D array', () => {
  it('treats first row as headers', () => {
    const json = JSON.stringify([
      ['Name', 'Score'],
      ['Alice', 95],
      ['Bob', 80],
    ])
    const result = parseJspreadsheetJson(json)
    expect(result.fields.map(f => f.id)).toEqual(['Name', 'Score'])
    expect(result.rows[0]).toEqual({ Name: 'Alice', Score: '95' })
    expect(result.rows[1]).toEqual({ Name: 'Bob', Score: '80' })
  })

  it('generates fallback header names for blank header cells', () => {
    const json = JSON.stringify([
      ['Name', '', null],
      ['Alice', 10, 20],
    ])
    const { fields } = parseJspreadsheetJson(json)
    expect(fields[1].id).toBe('column_2')
    expect(fields[2].id).toBe('column_3')
  })

  it('skips fully empty rows', () => {
    const json = JSON.stringify([
      ['A', 'B'],
      ['x', 'y'],
      ['', ''],
      ['z', 'w'],
    ])
    const { rows } = parseJspreadsheetJson(json)
    expect(rows).toHaveLength(2)
  })

  it('returns empty when only header row is present', () => {
    const json = JSON.stringify([['A', 'B']])
    const result = parseJspreadsheetJson(json)
    expect(result.fields).toHaveLength(0)
    expect(result.rows).toHaveLength(0)
  })
})

// ─── guard clauses ─────────────────────────────────────────────────────────────

describe('parseJspreadsheetJson — invalid input', () => {
  it('returns empty for invalid JSON', () => {
    const result = parseJspreadsheetJson('not json at all')
    expect(result.fields).toHaveLength(0)
    expect(result.rows).toHaveLength(0)
  })

  it('returns empty for empty string', () => {
    expect(parseJspreadsheetJson('').fields).toHaveLength(0)
  })

  it('returns empty for JSON null', () => {
    expect(parseJspreadsheetJson('null').fields).toHaveLength(0)
  })

  it('returns empty for empty array', () => {
    expect(parseJspreadsheetJson('[]').fields).toHaveLength(0)
  })

  it('returns empty for array of primitives', () => {
    expect(parseJspreadsheetJson('[1, 2, 3]').fields).toHaveLength(0)
  })

  it('returns empty for object (not array)', () => {
    expect(parseJspreadsheetJson('{"a":1}').fields).toHaveLength(0)
  })
})
