import type { ComponentProps } from 'react'
import { Modal } from '../../components/ui'
import { CartPanel } from './CartPanel'
import { ProductCatalog } from './ProductCatalog'

type Props = {
  catalog: ComponentProps<typeof ProductCatalog>
  cart: ComponentProps<typeof CartPanel>
  mobileCartOpen: boolean
  setMobileCartOpen: (open: boolean) => void
  storeName: string
}

export function POSWorkspace({
  catalog,
  cart,
  mobileCartOpen,
  setMobileCartOpen,
  storeName,
}: Props) {
  const subtitle = `${cart.count} item${cart.count === 1 ? '' : 's'} · ${storeName}`
  return (
    <>
      <div className="glass mx-3 mb-3 flex min-h-0 flex-1 overflow-hidden rounded-3xl">
        <ProductCatalog {...catalog} />
        <aside className="glass-strong hidden w-[380px] shrink-0 border-l border-line/70 lg:flex lg:flex-col">
          <CartPanel {...cart} />
        </aside>
      </div>
      <Modal
        open={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        title={cart.isOpenOrder ? `${cart.tableName ?? 'Table'} order` : 'Current order'}
        subtitle={subtitle}
        compact
      >
        <CartPanel embedded {...cart} />
      </Modal>
    </>
  )
}
