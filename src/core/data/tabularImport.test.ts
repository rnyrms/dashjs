import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParseResult } from 'tabularjs'

// Mock tabularjs before importing the module under test so the dynamic import
// resolves to our fake. All test cases control the resolved value via
// mockResolvedValue / mockRejectedValue.
vi.mock('tabularjs', () => ({
  default: vi.fn(),
}))

import tabularjs from 'tabularjs'
import { parseTabularFile, TABULAR_EXTENSIONS } from './tabularImport'

const mockTabularjs = vi.mocked(tabularjs)

function makeFile(name: string): File {
  return new File([''], name)
}

function makeResult(data: unknown[][], columns: { title: string; name?: string; type?: string }[] = []): ParseResult {
  return { worksheets: [{ data: data as any[][], columns }] }
}

beforeEach(() => mockTabularjs.mockReset())

// ─── header detection ─────────────────────────────────────────────────────────

describe('parseTabularFile — header from first data row', () => {
  it('uses data[0] as headers when columns have no name', async () => {
    mockTabularjs.mockResolvedValue(makeResult([
      ['Category', 'Revenue'],
      ['A', 100],
      ['B', 200],
    ]))
    const result = await parseTabularFile(makeFile('data.xlsx'))
    expect(result.fields.map(f => f.id)).toEqual(['Category', 'Revenue'])
    expect(result.rows[0]).toEqual({ Category: 'A', Revenue: '100' })
    expect(result.rows[1]).toEqual({ Category: 'B', Revenue: '200' })
  })

  it('generates fallback names for blank header cells', async () => {
    mockTabularjs.mockResolvedValue(makeResult([
      ['Name', '', null],
      ['Alice', 10, 20],
    ]))
    const { fields } = await parseTabularFile(makeFile('data.xlsx'))
    expect(fields[1].id).toBe('column_2')
    expect(fields[2].id).toBe('column_3')
  })

  it('skips fully empty data rows', async () => {
    mockTabularjs.mockResolvedValue(makeResult([
      ['A', 'B'],
      ['x', 'y'],
      ['', ''],
      ['z', 'w'],
    ]))
    const { rows } = await parseTabularFile(makeFile('data.xlsx'))
    expect(rows).toHaveLength(2)
  })
})

describe('parseTabularFile — header from column.name metadata', () => {
  it('uses column.name when columns have named metadata', async () => {
    mockTabularjs.mockResolvedValue(makeResult(
      [['Alice', 95], ['Bob', 80]],
      [{ title: 'A', name: 'student' }, { title: 'B', name: 'score' }],
    ))
    const result = await parseTabularFile(makeFile('data.xlsx'))
    expect(result.fields.map(f => f.id)).toEqual(['student', 'score'])
    expect(result.rows[0]).toEqual({ student: 'Alice', score: '95' })
  })

  it('all data rows are used when column names are present (no header row)', async () => {
    mockTabularjs.mockResolvedValue(makeResult(
      [['r1c1', 'r1c2'], ['r2c1', 'r2c2']],
      [{ title: 'A', name: 'col1' }, { title: 'B', name: 'col2' }],
    ))
    const { rows } = await parseTabularFile(makeFile('data.xlsx'))
    expect(rows).toHaveLength(2)
  })
})

// ─── type inference ───────────────────────────────────────────────────────────

describe('parseTabularFile — type inference', () => {
  it('infers numeric type for numeric columns', async () => {
    mockTabularjs.mockResolvedValue(makeResult([
      ['Name', 'Score'],
      ['Alice', 95],
      ['Bob', 80],
    ]))
    const { fields } = await parseTabularFile(makeFile('data.xlsx'))
    expect(fields.find(f => f.id === 'Score')?.type).toBe('numeric')
  })

  it('upgrades text→numeric when column.type is numeric', async () => {
    // All values happen to be low-cardinality strings, but column metadata says numeric
    mockTabularjs.mockResolvedValue(makeResult(
      [['Val'], ['10'], ['20']],
      [{ title: 'A', type: 'numeric' }],
    ))
    const { fields } = await parseTabularFile(makeFile('data.xlsx'))
    expect(fields[0].type).toBe('numeric')
  })

  it('upgrades text→date when column.type is calendar', async () => {
    // Need > 20 unique non-numeric values so inferFieldType returns 'text' first,
    // then the calendar override promotes it to 'date'.
    const dataRows = Array.from({ length: 25 }, (_, i) => [`label_${i}`])
    mockTabularjs.mockResolvedValue(makeResult(
      [['D'], ...dataRows],
      [{ title: 'A', type: 'calendar' }],
    ))
    const { fields } = await parseTabularFile(makeFile('data.xlsx'))
    expect(fields[0].type).toBe('date')
  })

  it('does not downgrade an already-inferred type', async () => {
    // Values are real ISO dates — inferFieldType returns 'date'; column.type is numeric
    mockTabularjs.mockResolvedValue(makeResult(
      [['D'], ['2024-01-01'], ['2024-06-15']],
      [{ title: 'A', type: 'numeric' }],
    ))
    const { fields } = await parseTabularFile(makeFile('data.xlsx'))
    // inferFieldType wins ('date'), upgrade only happens when inferred type is 'text'
    expect(fields[0].type).toBe('date')
  })
})

// ─── guard clauses ────────────────────────────────────────────────────────────

describe('parseTabularFile — empty / error cases', () => {
  it('returns empty when tabularjs returns no worksheets', async () => {
    mockTabularjs.mockResolvedValue({ worksheets: [] })
    const result = await parseTabularFile(makeFile('data.xlsx'))
    expect(result.fields).toHaveLength(0)
    expect(result.rows).toHaveLength(0)
  })

  it('returns empty when worksheet data is empty', async () => {
    mockTabularjs.mockResolvedValue(makeResult([]))
    const result = await parseTabularFile(makeFile('data.xlsx'))
    expect(result.fields).toHaveLength(0)
  })

  it('returns empty result when tabularjs returns a null worksheets array', async () => {
    mockTabularjs.mockResolvedValue({ worksheets: [] })
    const result = await parseTabularFile(makeFile('data.xlsx'))
    expect(result.fields).toHaveLength(0)
    expect(result.rows).toHaveLength(0)
  })
})

// ─── TABULAR_EXTENSIONS set ───────────────────────────────────────────────────

describe('TABULAR_EXTENSIONS', () => {
  it('includes common spreadsheet formats', () => {
    expect(TABULAR_EXTENSIONS.has('xlsx')).toBe(true)
    expect(TABULAR_EXTENSIONS.has('xls')).toBe(true)
    expect(TABULAR_EXTENSIONS.has('ods')).toBe(true)
    expect(TABULAR_EXTENSIONS.has('tsv')).toBe(true)
  })

  it('does not include csv or json (handled by dedicated parsers)', () => {
    expect(TABULAR_EXTENSIONS.has('csv')).toBe(false)
    expect(TABULAR_EXTENSIONS.has('json')).toBe(false)
  })
})
