import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button, Segmented } from '../../../components/ui'
import { useApp } from '../../../store/AppStore'
import { csvDownload } from '../../../lib/utils'
import { ReportCharts } from './ReportCharts'
import { ReportDetails } from './ReportDetails'
import { createReportData, type Period } from './reportData'
import { ReportSummary } from './ReportSummary'

export default function ReportsPage() {
  const { db, store } = useApp()
  const [period, setPeriod] = useState<Period>('month')
  if (!store) return null

  const data = createReportData(db, store, period, new Date())
  const exportSummary = () => {
    csvDownload(`report-${store.slug}-${period}.csv`, [
      ['Kawa POS report', `${store.name} — ${data.label}`],
      [],
      ['Sales', data.sales.toFixed(3)],
      ['Orders', data.orders.length],
      ['Average ticket', data.avgTicket.toFixed(3)],
      ['Expenses', data.expenses.toFixed(3)],
      ['Net profit', (data.sales - data.expenses).toFixed(3)],
      ['New tab charges', data.charges.toFixed(3)],
      ['Tab settlements', data.settled.toFixed(3)],
      ['Outstanding balance', data.outstanding.toFixed(3)],
      [],
      ['Top products', 'Qty', 'Revenue'],
      ...data.topProducts.map((product) => [product.name, product.qty, product.revenue.toFixed(3)]),
      [],
      ['Staff', 'Orders', 'Revenue'],
      ...data.staffList.map((staff) => [staff.name, staff.orders, staff.revenue.toFixed(3)]),
    ])
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Reports</h2>
          <p className="mt-1 text-[13px] text-muted">
            {data.label} · every number is calculated from your real orders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={period}
            onChange={setPeriod}
            size="sm"
            options={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
            ]}
          />
          <Button variant="secondary" size="sm" onClick={exportSummary}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      <ReportSummary
        sales={data.sales}
        orderCount={data.orders.length}
        avgTicket={data.avgTicket}
        expenses={data.expenses}
        categoryCount={data.expenseByCategory.size}
      />
      <ReportCharts
        period={period}
        series={data.series}
        seriesTotal={data.seriesTotal}
        sales={data.sales}
        paymentMix={data.paymentMix}
        paymentTotal={data.paymentTotal}
      />
      <ReportDetails data={data} customers={db.customers} ledger={db.ledger} storeId={store.id} />
    </div>
  )
}
