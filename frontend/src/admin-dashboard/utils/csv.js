// Builds a CSV (Excel opens it directly) and downloads it in the browser.
// rows: array of objects; columns: [[header, (row) => value], ...]
export function downloadCSV(filename, rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    columns.map(([h]) => esc(h)).join(','),
    ...rows.map((r) => columns.map(([, get]) => esc(get(r))).join(',')),
  ]
  // BOM so Excel reads ₱ and ñ correctly.
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}