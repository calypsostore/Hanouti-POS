import type { OrderChannel } from '../../types'
import { Segmented } from '../../components/ui'
import { cn } from '../../lib/utils'

export function ChannelSwitch({
  channel,
  setChannel,
  allowDelivery,
  className,
}: {
  channel: OrderChannel
  setChannel: (channel: OrderChannel) => void
  allowDelivery: boolean
  className?: string
}) {
  return (
    <Segmented
      value={channel}
      onChange={setChannel}
      size="sm"
      options={[
        { value: 'takeaway', label: 'Takeaway' },
        { value: 'dine-in', label: 'Dine-in' },
        ...(allowDelivery ? [{ value: 'delivery' as const, label: 'Delivery' }] : []),
      ]}
      className={cn('w-full [&>button]:flex-1', className)}
    />
  )
}
