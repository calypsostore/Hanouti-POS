import { ReceiptText, Users } from 'lucide-react'
import { Badge, Card } from '../../../components/ui'
import { balanceFor } from '../../../lib/selectors'
import { money } from '../../../lib/utils'
import type { ReportData } from './reportData'
import { ReportLine } from './ReportSummary'

export function ReportDetails({
  data,
  customers,
  ledger,
  storeId,
}: {
  data: ReportData
  customers: Array<{ id: string; storeId: string }>
  ledger: Parameters<typeof balanceFor>[0]
  storeId: string
}) {
  const { sales, topProducts, categoryList, staffList, charges, settled, outstanding, expenseByCategory } = data
  const openTabs = customers.filter(
    (customer) => customer.storeId === storeId && balanceFor(ledger, customer.id) > 0,
  ).length

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <div className="px-5 pb-3 pt-5">
            <h3 className="text-[15px] font-semibold tracking-tight">Top products</h3>
            <p className="mt-0.5 text-[12px] text-muted">By revenue in this period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line/70 text-[10.5px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-2 font-semibold">Product</th>
                  <th className="px-4 py-2 text-right font-semibold">Qty</th>
                  <th className="px-4 py-2 text-right font-semibold">Revenue</th>
                  <th className="px-5 py-2 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product) => (
                  <tr key={product.name} className="border-b border-line/50 text-[12.5px]">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-tint text-xs font-bold text-accent-foreground">
                          {product.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="font-medium text-ink">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted tabular">{product.qty}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular">{money(product.revenue)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-cream-200">
                          <div
                            className="h-full rounded-full bg-brand-navy"
                            style={{ width: `${sales > 0 ? (product.revenue / sales) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-8 text-[11px] text-muted tabular">
                          {sales > 0 ? Math.round((product.revenue / sales) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!topProducts.length && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-[12.5px] text-muted">
                      No products sold in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h3 className="text-[15px] font-semibold tracking-tight">Customer tabs</h3>
            <div className="mt-3 space-y-2.5 text-[12px]">
              <ReportLine label="New charges" value={money(charges)} />
              <ReportLine label="Settlements received" value={money(settled)} valueClass="text-[var(--semantic-green-text)]" />
              <div className="border-t border-dashed border-line pt-2.5">
                <ReportLine label="Outstanding overall" value={money(outstanding)} valueClass="text-accent-foreground" strong />
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-cream-100 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
              {outstanding > 0 ? `${openTabs} customers have an open tab.` : 'Every tab is settled. Clean books.'}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[15px] font-semibold tracking-tight">Expenses</h3>
            <div className="mt-3 space-y-2">
              {Array.from(expenseByCategory.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between text-[12px]">
                    <span className="text-muted">{name}</span>
                    <span className="font-semibold tabular">{money(amount)}</span>
                  </div>
                ))}
              {!expenseByCategory.size && (
                <p className="py-3 text-center text-[12px] text-muted">No expenses recorded.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="min-w-0 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Categories</h3>
              <p className="mt-0.5 text-[12px] text-muted">Revenue by menu section</p>
            </div>
            <Badge tone="neutral">{categoryList.length}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {categoryList.map((category) => (
              <div key={category.name}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-ink">{category.name}</span>
                  <span className="font-semibold tabular">{money(category.revenue)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-cream-200">
                  <div
                    className="h-full rounded-full bg-espresso-700"
                    style={{ width: `${sales > 0 ? (category.revenue / sales) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {!categoryList.length && (
              <p className="py-6 text-center text-[12.5px] text-muted">No category data.</p>
            )}
          </div>
        </Card>

        <Card className="min-w-0 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Staff performance</h3>
              <p className="mt-0.5 text-[12px] text-muted">Who sold what</p>
            </div>
            <Users className="h-4 w-4 text-muted" />
          </div>
          <div className="mt-4 space-y-3">
            {staffList.map((staff) => (
              <div key={staff.name} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cream-200 text-[11px] font-bold text-muted">
                  {staff.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-ink">{staff.name}</div>
                  <div className="text-[10.5px] text-muted">{staff.orders} orders</div>
                </div>
                <span className="text-[12.5px] font-bold tabular">{money(staff.revenue)}</span>
              </div>
            ))}
            {!staffList.length && (
              <p className="py-6 text-center text-[12.5px] text-muted">No sales in this period.</p>
            )}
          </div>
          {staffList.length > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-cream-100 px-3 py-2.5 text-[11px] text-muted">
              <ReceiptText className="h-3.5 w-3.5" />
              Best seller: <span className="font-semibold text-ink">{staffList[0].name}</span>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
