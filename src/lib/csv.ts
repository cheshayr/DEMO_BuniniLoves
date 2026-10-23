/**
 * CSV export helpers.
 * Text cells that start with = + - @ (or a tab/CR) are prefixed with an apostrophe so spreadsheet apps
 * never treat customer-supplied text (names, notes, addresses) as a formula ("CSV injection").
 */
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let s = String(value)
  if (FORMULA_START.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/** Downloads a CSV (UTF-8 with BOM so Excel shows ₱ and Filipino characters correctly). */
export function downloadCsv(filename: string, rows: unknown[][]) {
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
