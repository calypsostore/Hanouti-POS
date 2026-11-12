import { useState } from 'react'
import { CreditCard, HandCoins } from 'lucide-react'
import type { Customer } from '../../../../types'
import { Button, Field, Input, Modal, Segmented } from '../../../../components/ui'
import { money } from '../../../../lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  customer: Customer
  balance: number
  onSettle: (amount: number, method: 'cash' | 'card', note: string) => void
}

export default function SettleModal({ open, onClose, customer, balance, onSettle }: Props) {
  const [amount, setAmount] = useState(balance ? String(balance.toFixed(3)) : '')
  const [method, setMethod] = useState<'cash' | 'card'>('cash')
  const [note, setNote] = useState('')
  const value = Number(amount) || 0
  const valid = value > 0 && value <= balance + 0.0001

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Take payment"
      subtitle={`${customer.name} · balance ${money(balance)}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-muted">
            {valid ? `Remaining after payment · ${money(balance - value)}` : 'Enter a valid amount'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!valid} onClick={() => onSettle(value, method, note)}>
              <HandCoins className="h-4 w-4" /> Receive {money(value)}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-espresso-900 px-5 py-4 text-cream-50">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">
            Current balance
          </div>
          <div className="mt-1 text-[28px] font-extrabold tracking-tight tabular">
            {money(balance)}
          </div>
        </div>
        <Field label="Amount received" hint="Partial payments are fine">
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-12 text-lg font-bold tabular"
            autoFocus
          />
        </Field>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAmount(String(balance.toFixed(3)))}
          >
            Full balance
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAmount(String((balance / 2).toFixed(3)))}
          >
            Half
          </Button>
        </div>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">Method</span>
          <Segmented
            value={method}
            onChange={setMethod}
            className="w-full [&>button]:flex-1"
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
            ]}
          />
        </div>
        {method === 'card' && (
          <p className="flex items-center gap-2 rounded-lg bg-cream-100 px-3 py-2 text-[11.5px] text-muted">
            <CreditCard className="h-3.5 w-3.5" /> Confirm on the terminal before saving.
          </p>
        )}
        <Field label="Note" hint="Optional">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. month-end settlement"
          />
        </Field>
      </div>
    </Modal>
  )
}
