import { columnsFor, encodeCp1252, type ReceiptLine } from './escpos'
import type { PrinterWidth } from '../types'

const mmToPoints = (millimetres: number) => (millimetres * 72) / 25.4
const hexBytes = (text: string) =>
  Array.from(encodeCp1252(text), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
const truncate = (text: string, columns: number) => Array.from(text).slice(0, columns).join('')

export const createReceiptPdf = (lines: ReceiptLine[], width: PrinterWidth): Uint8Array => {
  const pageWidth = mmToPoints(width)
  const margin = mmToPoints(3)
  const fontSize = width === 58 ? 7.5 : 7.2
  const lineHeights = lines.map((line) => line.size === 'double' ? 15 : 10)
  const pageHeight = margin * 2 + lineHeights.reduce((total, height) => total + height, 0)
  let cursorY = pageHeight - margin
  const columns = columnsFor(width)
  const content = lines.map((line, index) => {
    const text = truncate(line.text, columns)
    const size = line.size === 'double' ? 12 : fontSize
    const advance = size * 0.6
    const textWidth = Array.from(text).length * advance
    const x = line.align === 'center'
      ? Math.max(margin, (pageWidth - textWidth) / 2)
      : line.align === 'right'
        ? Math.max(margin, pageWidth - margin - textWidth)
        : margin
    cursorY -= lineHeights[index]
    if (!text) return ''
    return `BT /${line.bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${cursorY.toFixed(2)} Tm <${hexBytes(text)}> Tj ET`
  }).filter(Boolean).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new TextEncoder().encode(pdf)
}

export const downloadReceiptPdf = (lines: ReceiptLine[], width: PrinterWidth, filename: string) => {
  const pdf = createReceiptPdf(lines, width)
  const pdfCopy = new Uint8Array(pdf.byteLength)
  pdfCopy.set(pdf)
  const blob = new Blob([pdfCopy.buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
