import { useState } from 'react'
import { ArrowRight, Check, Coffee, ShoppingBag, Sparkles, Store, Utensils, Wheat, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card } from '../../components/ui'
import { useToast } from '../../components/toast'
import { businessTemplate } from '../../lib/businessTemplates'
import { useApp } from '../../store/AppStore'
import type { BusinessType } from '../../types'
import { cn } from '../../lib/utils'
import { BrandLogo } from '../../components/BrandLogo'

const businessTypes: Array<{ value: BusinessType; label: string; icon: LucideIcon; description: string }> = [
  { value: 'cafe', label: 'Cafe', icon: Coffee, description: 'Coffee, tea, pastries and counter service.' },
  { value: 'restaurant', label: 'Restaurant', icon: Utensils, description: 'Tables, kitchen workflow and full meals.' },
  { value: 'bakery', label: 'Bakery', icon: Wheat, description: 'Bread, pastries and optional weight sales.' },
  { value: 'snack', label: 'Snack shop', icon: ShoppingBag, description: 'Fast takeaway and quick orders.' },
  { value: 'retail', label: 'Retail', icon: Store, description: 'Products, barcode scanning and weighed goods.' },
  { value: 'salon', label: 'Salon', icon: Sparkles, description: 'Appointments or services and retail products.' },
]

export default function SetupWizard() {
  const { store, completeBusinessSetup } = useApp()
  const { push } = useToast()
  const navigate = useNavigate()
  const [businessType, setBusinessType] = useState<BusinessType>(store?.businessType ?? 'cafe')
  if (!store) return null
  const template = businessTemplate(businessType)

  const finish = () => {
    const result = completeBusinessSetup(store.id, businessType)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Business setup saved')
    navigate('/admin', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cream-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <BrandLogo size="md" className="mx-auto justify-center" />
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Set up {store.name}</h1>
          <p className="mt-2 text-sm text-muted">Choose your business type to apply a practical starting template.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {businessTypes.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setBusinessType(option.value)}
              className={cn(
                'rounded-2xl border bg-white p-4 text-left transition',
                businessType === option.value
                  ? 'border-accent-foreground ring-2 ring-accent-foreground/20'
                  : 'border-line hover:border-accent-foreground/40',
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-tint text-brand-navy">
                <option.icon className="h-5 w-5" />
              </span>
              <span className="mt-2 block text-sm font-bold text-ink">{option.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{option.description}</span>
            </button>
          ))}
        </div>
        <Card className="mt-4 p-5">
          <h2 className="text-sm font-bold text-ink">Template preview</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Categories</div>
              <div className="mt-1 text-xs text-ink">{template.categories.map((category) => category.name).join(' · ')}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Register mode</div>
              <div className="mt-1 text-xs capitalize text-ink">{template.posMode}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Enabled features</div>
              <div className="mt-1 text-xs text-ink">
                {Object.entries(template.features).filter(([, enabled]) => enabled).map(([feature]) => feature).join(', ') || 'None'}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={finish}>
              Apply template <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
        <div className="mt-4 flex items-center justify-center gap-1 text-[11px] text-muted">
          <Check className="h-3 w-3 text-emerald-600" /> You can adjust features and receipt branding later in Settings.
        </div>
      </div>
    </div>
  )
}
