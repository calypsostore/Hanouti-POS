import { columnsFor, type ReceiptLine } from '../lib/escpos'
import type { PrinterWidth } from '../types'

const truncate = (text: string, columns: number) => Array.from(text).slice(0, columns).join('')

export function ThermalReceipt({ lines, width }: { lines: ReceiptLine[]; width: PrinterWidth }) {
  const columns = columnsFor(width)

  return (
    <div
      className="thermal-receipt"
      style={{ width: `${width}mm`, fontSize: width === 58 ? '10px' : '9px' }}
      aria-label={`${width} millimetre thermal receipt`}
    >
      {lines.map((line, index) => (
        <div
          key={index}
          className="thermal-receipt-line"
          style={{
            textAlign: line.align ?? 'left',
            fontWeight: line.bold ? 700 : 400,
            fontSize: line.size === 'double' ? '1.55em' : undefined,
            lineHeight: line.size === 'double' ? 1.45 : undefined,
          }}
        >
          {truncate(line.text, columns) || '\u00a0'}
        </div>
      ))}
    </div>
  )
}
