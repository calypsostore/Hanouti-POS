import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button, Segmented } from '../../../components/ui'
import { useApp } from '../../../store/AppStore'
import { csvDownload, money } from '../../../lib/utils'
import { BRAND_NAME } from '../../../lib/brand'
import { ReportCharts } from './ReportCharts'
import { ReportDetails } from './ReportDetails'
import { createReportData, type Period } from './reportData'
import { ReportSummary } from './ReportSummary'
import { getStaffPerformance } from '../../../lib/staffPerformance'
import { DataTable, type DataTableColumn } from '../../../components/data/DataTable'
import { Card, Badge } from '../../../components/ui'
import { can } from '../../../lib/permissions'

export default function ReportsPage() {
  const { db, store, user } = useApp()
  const [period, setPeriod] = useState<Period>('month')
  const [now] = useState(() => new Date())
  if (!store) return null

  const data = createReportData(db, store, period, now)
  const staffRows = user && can(user, 'viewStaffAnalytics')
    ? db.users.filter((member) => member.storeId === store.id && member.role === 'staff')
      .map((member) => ({
        member,
        stats: getStaffPerformance(db, store.id, member.id, period, now, store.settings.automation.cashDifferenceTolerance),
      }))
    : []
  const staffColumns: DataTableColumn<typeof staffRows[number]>[] = [
    { key: 'name', header: 'Staff', render: (row) => row.member.name },
    { key: 'shifts', header: 'Shifts', render: (row) => row.stats.shifts },
    { key: 'sales', header: 'Sales', render: (row) => money(row.stats.sales) },
    { key: 'orders', header: 'Orders', render: (row) => row.stats.orders },
    { key: 'ticket', header: 'Avg ticket', render: (row) => money(row.stats.averageTicket) },
    { key: 'tables', header: 'Tables', render: (row) => row.stats.tablesServed },
    { key: 'voids', header: 'Voids / discount', render: (row) => `${row.stats.voids} / ${row.stats.discountRate}%` },
    { key: 'accuracy', header: 'Cash accuracy', render: (row) => `${row.stats.cashAccuracy}%` },
    { key: 'variance', header: 'Shortage / overage', render: (row) => `${money(row.stats.shortage)} / ${money(row.stats.overage)}` },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={row.stats.status === 'Excellent' ? 'success' : row.stats.status === 'Good' ? 'warning' : 'danger'}>{row.stats.status}</Badge> },
  ]
  const exportSummary = () => {
    csvDownload(`report-${store.slug}-${period}.csv`, [
      [`${BRAND_NAME} report`, `${store.name} — ${data.label}`],
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
      {staffRows.length > 0 && (
        <Card className="p-3">
          <h3 className="mb-2 px-2 text-sm font-bold text-ink">Staff shift comparison</h3>
          <DataTable columns={staffColumns} rows={staffRows} rowKey={(row) => row.member.id} empty="No staff shifts in this period." />
        </Card>
      )}
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
