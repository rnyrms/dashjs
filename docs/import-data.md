title: Importing Data
keywords: dashjs, import data, CSV import, Excel import, XLSX, ODS, Jspreadsheet JSON, TabularJS, file upload, data import modal
description: Guide to all data import paths in Dashjs — CSV files, Jspreadsheet JSON format, and spreadsheet files (XLSX, XLS, ODS, TSV, and more) via the built-in TabularJS integration.
canonical: https://dashjs.com/docs/import-data

# Importing Data

The Dashjs editor includes a built-in **Import Data** dialog reachable from the toolbar. It supports three import paths:

- **File upload** — CSV files parsed directly; spreadsheet files (XLSX, XLS, ODS, TSV, and more) converted via TabularJS
- **Paste JSON** — direct paste of Jspreadsheet's `getJson()` or `getData()` output
- **Custom data source** — for live or backend-backed data, implement `DashJsDataSource` instead (see [Data Sources](/docs/data-sources))


## File upload

### CSV

Dropped or selected `.csv` files are parsed by the built-in RFC-4180-compliant parser:

- First row is treated as column headers
- Blank header cells receive auto-generated names (`column_2`, `column_3`, …)
- Fully empty rows are skipped
- Field types are inferred automatically from the column values

### Spreadsheet formats (via TabularJS)

Files with the following extensions are converted by [TabularJS](https://tabularjs.com/):

| Extension | Format |
|-----------|--------|
| `.xlsx` | Excel 2007+ |
| `.xls` | Legacy Excel |
| `.ods` | OpenDocument Spreadsheet |
| `.tsv` | Tab-separated values |
| `.dif` | Data Interchange Format |
| `.dbf` | dBASE |
| `.slk` | Symbolic Link |
| `.wks` | Lotus 1-2-3 |
| `.xml` | XML Spreadsheet |

When TabularJS detects named column metadata (e.g. from an Excel table), those names are used as field IDs. Otherwise the first data row is treated as the header row.


## Paste JSON

The **Paste JSON** tab accepts either of Jspreadsheet's two output formats:

### Array-of-objects (`worksheet.getJson()`)

Keys become field IDs and column names. Values are coerced to strings internally; numeric and date columns are detected automatically.

```json
[
  { "Product": "Widget", "Revenue": 120, "Region": "North" },
  { "Product": "Gadget", "Revenue": 340, "Region": "South" }
]
```

### 2-D array (`worksheet.getData()`)

First row is the header. Subsequent rows are data. Blank header cells receive auto-generated names.

```json
[
  ["Product", "Revenue", "Region"],
  ["Widget", 120, "North"],
  ["Gadget", 340, "South"]
]
```


## Field type inference

After import, field types are inferred automatically:

| Inferred type | Rule |
|---------------|------|
| `numeric` | All non-empty values are valid numbers |
| `date` | All non-empty values match `YYYY-MM-DD…` |
| `single` | Unique value count < `max(20, rowCount / 3)` — treated as a low-cardinality categorical |
| `text` | Everything else |

TabularJS imports additionally respect the column's `type` metadata:

- If the spreadsheet column is tagged `numeric` and inference returned `text`, the field is promoted to `numeric`
- If the column is tagged `calendar` and inference returned `text`, the field is promoted to `date`
- Already-inferred `numeric` or `date` types are never downgraded

You can change field types in the editor's field panel after import.


## Internal data flow

All three import paths produce a `CsvParseResult` internally:

```typescript
interface CsvParseResult {
  fields: DataField[]
  rows: Record<string, string>[]
}
```

Once imported, `fields` populates the field catalogue and `rows` is used by `getChartData()` to produce `ChartDataSeries` for each chart.


## Programmatic import (advanced)

The three parsers are exported from the library internals and can be used directly in your own integration:

```typescript
// Parse a CSV string
import { parseCsv } from 'dashjs/src/core/charts/csv'
const result = parseCsv(csvString)

// Parse Jspreadsheet JSON (both formats)
import { parseJspreadsheetJson } from 'dashjs/src/core/data/parseJson'
const result = parseJspreadsheetJson(jsonString)

// Parse a File object from an <input type="file">
import { parseTabularFile } from 'dashjs/src/core/data/tabularImport'
const result = await parseTabularFile(file)
```

All three functions return `{ fields: DataField[], rows: Record<string, string>[] }` and never throw — they return `{ fields: [], rows: [] }` on parse errors.


## Examples

### Export from Jspreadsheet and import to Dashjs

```javascript
import jspreadsheet from 'jspreadsheet'
import { parseJspreadsheetJson } from 'dashjs/src/core/data/parseJson'

const worksheets = jspreadsheet(element, { worksheets: [{ data: myData, columns: myCols }] })
const worksheet = worksheets[0]

// Option A — array-of-objects (getJson)
const jsonA = JSON.stringify(worksheet.getJson(true))
const resultA = parseJspreadsheetJson(jsonA)

// Option B — 2-D array (getData) — include headers
const raw = worksheet.getData(false, false)
const headers = (worksheet.options.columns ?? []).map(c => c.title ?? c.name ?? '')
const jsonB = JSON.stringify([headers, ...raw])
const resultB = parseJspreadsheetJson(jsonB)
```

### File import from a custom button

```javascript
import { parseTabularFile, TABULAR_EXTENSIONS } from 'dashjs/src/core/data/tabularImport'
import { parseCsv } from 'dashjs/src/core/charts/csv'

const input = document.createElement('input')
input.type = 'file'
input.accept = '.csv,.xlsx,.xls,.ods,.tsv'

input.addEventListener('change', async () => {
  const file = input.files?.[0]
  if (!file) return

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  let result

  if (ext === 'csv') {
    result = parseCsv(await file.text())
  } else if (TABULAR_EXTENSIONS.has(ext)) {
    result = await parseTabularFile(file)
  } else {
    console.warn('Unsupported file type:', ext)
    return
  }

  console.log('Fields:', result.fields)
  console.log('Rows:', result.rows)
})

input.click()
```
