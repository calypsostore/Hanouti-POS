import { Download } from 'lucide-react'
import { Button } from '../ui'
import { csvDownload } from '../../lib/utils'

export default function CsvExportButton({
  filename,
  rows,
}: {
  filename: string
  rows: (string | number)[][]
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={rows.length < 2}
      onClick={() => csvDownload(filename, rows)}
    >
      <Download className="h-3.5 w-3.5" /> Export CSV
    </Button>
  )
}
