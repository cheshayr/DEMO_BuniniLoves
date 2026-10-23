/**
 * Tiny dependency-free PDF writer used for printable admin exports (orders, customers, performance report).
 * It draws headings, summary tiles, tables (with wrapping + repeated header rows) and bar charts using the
 * built-in Helvetica font, so no package or font download is needed.
 *
 * Text is encoded as Windows-1252: Latin letters (including Filipino ñ), common punctuation and ₱ (written as "PHP")
 * print correctly; anything else (e.g. emoji) prints as "?".
 */

export type Align = 'left' | 'right' | 'center'
export interface PdfColumn { header: string; weight: number; align?: Align }
export interface BarPoint { label: string; value: number; valueLabel?: string }
export type PdfBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'kv'; items: [string, string][] }
  | { type: 'table'; columns: PdfColumn[]; rows: string[][]; foot?: string[] }
  | { type: 'bars'; points: BarPoint[]; height?: number }
  | { type: 'hbars'; points: BarPoint[] }
export interface PdfDoc { title: string; subtitle?: string; landscape?: boolean; footer?: string; blocks: PdfBlock[] }

/* ---------- text encoding & metrics ---------- */

const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}

/** Converts text to Windows-1252 byte values (unknown characters become "?"). */
export function encodeWinAnsi(input: string): number[] {
  const out: number[] = []
  for (const ch of input.replace(/₱/g, 'PHP ').normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 63
    if (code >= 32 && code <= 126) out.push(code)
    else if (code >= 0xa0 && code <= 0xff) out.push(code)
    else if (CP1252[ch] !== undefined) out.push(CP1252[ch])
    else if (code === 9 || code === 10 || code === 13) out.push(32)
    else if (code < 32 || (code >= 0x7f && code < 0xa0) || (code >= 0x200b && code <= 0x200f) || code === 0xfe0f) continue // control / zero-width / emoji selector
    else out.push(63)
  }
  return out
}

// Helvetica advance widths for ASCII 32..126 (units per 1000 em).
const W = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // space ! " # $ % & ' ( ) * + , - . /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0-9 : ; < = > ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ A-O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P-Z [ \ ] ^ _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` a-o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,       // p-z { | } ~
]
const BOLD_FACTOR = 1.08 // Helvetica-Bold is a little wider; measured conservatively so text never overflows

const byteWidth = (b: number) => (b >= 32 && b <= 126 ? W[b - 32] : b === 0x85 ? 1000 : 556)
export const textWidth = (s: string, size: number, bold = false) =>
  (encodeWinAnsi(s).reduce((sum, b) => sum + byteWidth(b), 0) / 1000) * size * (bold ? BOLD_FACTOR : 1)

/** Wraps text into lines no wider than maxWidth (hard breaks on \n, long words split). Extra lines are cut with "…". */
export function wrapText(text: string, maxWidth: number, size: number, bold = false, maxLines = 6): string[] {
  const lines: string[] = []
  for (const para of String(text ?? '').split(/\r?\n/)) {
    let line = ''
    const push = () => { lines.push(line); line = '' }
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const attempt = line ? `${line} ${word}` : word
      if (textWidth(attempt, size, bold) <= maxWidth) { line = attempt; continue }
      if (line) push()
      if (textWidth(word, size, bold) <= maxWidth) { line = word; continue }
      let chunk = ''
      for (const ch of word) {
        if (textWidth(chunk + ch, size, bold) > maxWidth && chunk) { lines.push(chunk); chunk = '' }
        chunk += ch
      }
      line = chunk
    }
    push()
  }
  if (lines.length === 0) lines.push('')
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last && textWidth(`${last}…`, size, bold) > maxWidth) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last.trimEnd()}…`
    return kept
  }
  return lines
}

/* ---------- drawing primitives ---------- */

type RGB = [number, number, number]
const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255]
const num = (n: number) => (Math.round(n * 100) / 100).toString()
const COLOR = {
  ink: rgb('#2b1a2e'), muted: rgb('#6b5a6e'), pink: rgb('#d93a78'), pinkSoft: rgb('#ffd6e8'), pinkFaint: rgb('#fff5fa'),
  sun: rgb('#ffe566'), sunSoft: rgb('#fff2a8'), line: rgb('#e8b3c9'), white: rgb('#ffffff'),
}

function pdfString(input: string): string {
  let s = '('
  for (const b of encodeWinAnsi(input)) {
    if (b === 40 || b === 41 || b === 92) s += `\\${String.fromCharCode(b)}`
    else if (b < 32 || b > 126) s += `\\${b.toString(8).padStart(3, '0')}`
    else s += String.fromCharCode(b)
  }
  return `${s})`
}

class Canvas {
  ops: string[] = []
  w: number
  h: number
  constructor(w: number, h: number) { this.w = w; this.h = h }
  fill([r, g, b]: RGB) { this.ops.push(`${num(r)} ${num(g)} ${num(b)} rg`) }
  stroke([r, g, b]: RGB, width = 0.6) { this.ops.push(`${num(r)} ${num(g)} ${num(b)} RG ${num(width)} w`) }
  /** y is measured from the TOP of the page. */
  rect(x: number, top: number, w: number, h: number, color: RGB) { this.fill(color); this.ops.push(`${num(x)} ${num(this.h - top - h)} ${num(w)} ${num(h)} re f`) }
  box(x: number, top: number, w: number, h: number, color: RGB) { this.stroke(color); this.ops.push(`${num(x)} ${num(this.h - top - h)} ${num(w)} ${num(h)} re S`) }
  line(x1: number, top1: number, x2: number, top2: number, color: RGB, width = 0.6) { this.stroke(color, width); this.ops.push(`${num(x1)} ${num(this.h - top1)} m ${num(x2)} ${num(this.h - top2)} l S`) }
  text(x: number, baselineTop: number, s: string, size: number, color: RGB = COLOR.ink, bold = false) {
    if (!s) return
    this.fill(color)
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(x)} ${num(this.h - baselineTop)} Td ${pdfString(s)} Tj ET`)
  }
  textAligned(left: number, width: number, baselineTop: number, s: string, size: number, align: Align, color: RGB = COLOR.ink, bold = false) {
    const tw = textWidth(s, size, bold)
    const x = align === 'right' ? left + width - tw : align === 'center' ? left + (width - tw) / 2 : left
    this.text(x, baselineTop, s, size, color, bold)
  }
}

/* ---------- layout ---------- */

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 36

/** Rounds a chart maximum up to a "nice" number (1, 2, 2.5, 5 × 10ⁿ). */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1
  const pow = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * pow) return m * pow
  return 10 * pow
}

export function buildPdf(doc: PdfDoc): Uint8Array {
  const [PW, PH] = doc.landscape ? [A4[1], A4[0]] : A4
  const contentW = PW - MARGIN * 2
  const bottom = PH - MARGIN - 14 // leave room for the page footer
  const pages: Canvas[] = []
  let cv = new Canvas(PW, PH) // replaced by newPage() below before anything is drawn
  let y = MARGIN

  const newPage = (first: boolean) => {
    cv = new Canvas(PW, PH)
    pages.push(cv)
    y = MARGIN
    if (first) {
      cv.text(MARGIN, y + 8, 'BUNINI LOVES', 8, COLOR.pink, true)
      y += 38
      cv.text(MARGIN, y, doc.title, 19, COLOR.ink, true)
      y += 8
      cv.rect(MARGIN, y, 54, 4, COLOR.sun)
      y += 16
      if (doc.subtitle) {
        for (const l of wrapText(doc.subtitle, contentW, 9.5, false, 3)) { cv.text(MARGIN, y, l, 9.5, COLOR.muted); y += 12.5 }
      }
      y += 8
    } else {
      cv.text(MARGIN, y + 8, `BUNINI LOVES · ${doc.title}`, 7.5, COLOR.muted)
      y += 22
    }
  }
  const ensure = (h: number) => { if (y + h > bottom) newPage(false) }
  newPage(true)

  for (const block of doc.blocks) {
    if (block.type === 'heading') {
      ensure(40)
      y += 10
      cv.text(MARGIN, y + 8, block.text, 12, COLOR.ink, true)
      y += 14
      cv.rect(MARGIN, y, 30, 2.5, COLOR.sun)
      y += 12
    } else if (block.type === 'text') {
      for (const l of wrapText(block.text, contentW, 9, false, 40)) { ensure(13); cv.text(MARGIN, y + 9, l, 9, COLOR.muted); y += 12.5 }
      y += 4
    } else if (block.type === 'kv') {
      const perRow = doc.landscape ? 5 : 3
      const gap = 8
      const tileW = (contentW - gap * (perRow - 1)) / perRow
      for (let i = 0; i < block.items.length; i += perRow) {
        ensure(46)
        block.items.slice(i, i + perRow).forEach(([label, value], j) => {
          const x = MARGIN + j * (tileW + gap)
          cv.rect(x, y, tileW, 40, COLOR.sunSoft)
          cv.box(x, y, tileW, 40, COLOR.ink)
          cv.text(x + 8, y + 14, wrapText(label, tileW - 16, 7.5, false, 1)[0], 7.5, COLOR.muted)
          cv.text(x + 8, y + 31, wrapText(value, tileW - 16, 13, true, 1)[0], 13, COLOR.ink, true)
        })
        y += 48
      }
    } else if (block.type === 'table') {
      const size = 8.5, lead = 10.8, padX = 4, padY = 3.5
      const totalWeight = block.columns.reduce((s, c) => s + c.weight, 0) || 1
      const widths = block.columns.map((c) => (c.weight / totalWeight) * contentW)
      const lefts = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((s, w) => s + w, 0))
      const header = () => {
        const lines = block.columns.map((c, i) => wrapText(c.header, widths[i] - padX * 2, size, true, 2))
        const h = Math.max(...lines.map((l) => l.length)) * lead + padY * 2
        cv.rect(MARGIN, y, contentW, h, COLOR.pinkSoft)
        lines.forEach((ls, i) => ls.forEach((l, k) => cv.textAligned(lefts[i] + padX, widths[i] - padX * 2, y + padY + lead * (k + 1) - 2.6, l, size, block.columns[i].align ?? 'left', COLOR.ink, true)))
        y += h
        cv.line(MARGIN, y, MARGIN + contentW, y, COLOR.ink, 0.8)
      }
      const drawRow = (cells: string[], index: number, foot: boolean) => {
        const lines = block.columns.map((_, i) => wrapText(cells[i] ?? '', widths[i] - padX * 2, size, foot, 6))
        const h = Math.max(...lines.map((l) => l.length)) * lead + padY * 2
        if (y + h > bottom) { newPage(false); header() }
        if (foot) cv.rect(MARGIN, y, contentW, h, COLOR.sun)
        else if (index % 2 === 1) cv.rect(MARGIN, y, contentW, h, COLOR.pinkFaint)
        lines.forEach((ls, i) => ls.forEach((l, k) => cv.textAligned(lefts[i] + padX, widths[i] - padX * 2, y + padY + lead * (k + 1) - 2.6, l, size, block.columns[i].align ?? 'left', COLOR.ink, foot)))
        y += h
        cv.line(MARGIN, y, MARGIN + contentW, y, foot ? COLOR.ink : COLOR.line, foot ? 0.8 : 0.4)
      }
      ensure(60)
      header()
      if (block.rows.length === 0) { ensure(24); cv.text(MARGIN + padX, y + 15, 'No records for this selection.', 9, COLOR.muted); y += 24 }
      block.rows.forEach((r, i) => drawRow(r, i, false))
      if (block.foot) drawRow(block.foot, 0, true)
      y += 10
    } else if (block.type === 'bars') {
      const chartH = block.height ?? 150
      const labelH = 26
      ensure(chartH + labelH + 20)
      const axisW = 44
      const plotX = MARGIN + axisW
      const plotW = contentW - axisW
      const top = y + 12
      const max = niceMax(Math.max(0, ...block.points.map((p) => p.value)))
      for (let g = 0; g <= 4; g++) {
        const gy = top + chartH - (chartH * g) / 4
        cv.line(plotX, gy, plotX + plotW, gy, g === 0 ? COLOR.ink : COLOR.line, g === 0 ? 0.8 : 0.4)
        const label = block.points.length ? formatAxis((max * g) / 4) : ''
        cv.textAligned(MARGIN, axisW - 6, gy + 3, label, 7, 'right', COLOR.muted)
      }
      const n = Math.max(1, block.points.length)
      const slot = plotW / n
      const barW = Math.min(34, slot * 0.68)
      const widest = Math.max(1, ...block.points.map((p) => textWidth(p.label, 7)))
      const every = Math.max(1, Math.ceil((widest + 6) / slot))
      block.points.forEach((p, i) => {
        const bx = plotX + slot * i + (slot - barW) / 2
        const bh = max > 0 ? (chartH * p.value) / max : 0
        if (bh > 0) cv.rect(bx, top + chartH - bh, barW, bh, COLOR.pink)
        if (block.points.length <= 16 && p.value > 0) cv.textAligned(plotX + slot * i, slot, top + chartH - bh - 3, p.valueLabel ?? String(p.value), 6.5, 'center', COLOR.ink, true)
        if (i % every === 0) cv.textAligned(plotX + slot * i - (every > 1 ? 0 : 0), slot * every, top + chartH + 11, p.label, 7, 'center', COLOR.muted)
      })
      if (block.points.every((p) => p.value === 0)) cv.textAligned(plotX, plotW, top + chartH / 2, 'Nothing to show for this period yet', 9, 'center', COLOR.muted)
      y = top + chartH + labelH
    } else if (block.type === 'hbars') {
      const rowH = 20
      const labelW = Math.min(230, contentW * 0.4)
      const valueW = 96
      const barX = MARGIN + labelW + 8
      const barW = contentW - labelW - valueW - 12
      const max = Math.max(1, ...block.points.map((p) => p.value))
      if (block.points.length === 0) { ensure(24); cv.text(MARGIN, y + 14, 'No sales in this period yet.', 9, COLOR.muted); y += 24 }
      block.points.forEach((p, i) => {
        ensure(rowH + 2)
        cv.text(MARGIN, y + 13, `${i + 1}.`, 8, COLOR.muted)
        cv.text(MARGIN + 14, y + 13, wrapText(p.label, labelW - 14, 8.5, false, 1)[0], 8.5)
        cv.rect(barX, y + 3, barW, 12, COLOR.pinkFaint)
        cv.rect(barX, y + 3, Math.max(2, (barW * p.value) / max), 12, i === 0 ? COLOR.sun : COLOR.pink)
        if (i === 0) cv.box(barX, y + 3, Math.max(2, (barW * p.value) / max), 12, COLOR.ink)
        cv.textAligned(barX + barW + 6, valueW, y + 13, p.valueLabel ?? String(p.value), 8.5, 'right', COLOR.ink, true)
        y += rowH
      })
      y += 6
    }
  }

  // Page footers (need the final page count).
  pages.forEach((p, i) => {
    p.line(MARGIN, PH - MARGIN - 6, PW - MARGIN, PH - MARGIN - 6, COLOR.line, 0.5)
    p.text(MARGIN, PH - MARGIN + 6, doc.footer ?? '', 7.5, COLOR.muted)
    p.textAligned(PW - MARGIN - 100, 100, PH - MARGIN + 6, `Page ${i + 1} of ${pages.length}`, 7.5, 'right', COLOR.muted)
  })

  /* ---------- serialise ---------- */
  const objs: string[] = []
  const add = (body: string) => { objs.push(body); return objs.length } // returns the 1-based object number
  const catalog = add('') // 1
  const pagesRoot = add('') // 2
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>') // 3
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>') // 4
  const info = add(`<< /Title ${pdfString(doc.title)} /Producer (Bunini Loves) >>`)
  const kids: number[] = []
  for (const p of pages) {
    const stream = p.ops.join('\n')
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    kids.push(add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${num(PW)} ${num(PH)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`))
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`
  objs[pagesRoot - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Uint8Array.from(out, (c) => c.charCodeAt(0) & 0xff)
}

function formatAxis(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `${+(v / 1000).toFixed(0)}k`
  if (v >= 1000) return `${+(v / 1000).toFixed(1)}k`
  return String(+v.toFixed(2))
}

/** Currency for PDFs (₱ is not in the built-in font, so "PHP" is used). */
const pdfNumber = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const pdfMoney = (centavos: number) => `PHP ${pdfNumber.format(centavos / 100)}`

export function downloadPdf(filename: string, doc: PdfDoc) {
  const blob = new Blob([buildPdf(doc).buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
