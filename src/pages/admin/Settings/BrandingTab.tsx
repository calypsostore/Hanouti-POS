import { Check, Image, Monitor, Moon, Palette, Sun } from 'lucide-react'
import type { Store, StoreSettings } from '../../../types'
import { Card } from '../../../components/ui'
import { ImageUpload } from '../../../components/ImageUpload'
import { accentPalettes, applyColorMode, saveColorMode } from '../../../lib/theme'
import { cn } from '../../../lib/utils'

type StoreProfile = Pick<Store, 'name' | 'icon' | 'iconColor' | 'logo' | 'phone' | 'address' | 'city' | 'ownerName'>
type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void

export default function BrandingTab({
  form,
  setForm,
  settings,
  set,
}: {
  form: StoreProfile
  setForm: React.Dispatch<React.SetStateAction<StoreProfile>>
  settings: StoreSettings
  set: SettingsSetter
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <Image className="h-4 w-4 text-accent-foreground" />
          <h3 className="text-[15px] font-semibold tracking-tight">Store logo</h3>
        </div>
        <p className="mb-4 text-[12px] text-muted">
          Used in the navigation and point-of-sale header.
        </p>
        <ImageUpload
          value={form.logo}
          label="Upload store logo"
          onChange={(logo) => setForm((current) => ({ ...current, logo }))}
        />
      </Card>

      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <Palette className="h-4 w-4 text-accent-foreground" />
          <h3 className="text-[15px] font-semibold tracking-tight">Accent colour</h3>
        </div>
        <p className="mb-4 text-[12px] text-muted">Used across your dashboard and register.</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {accentPalettes.map((palette) => (
            <button
              key={palette.id}
              type="button"
              aria-pressed={settings.accent === palette.id}
              onClick={() => set('accent', palette.id)}
              className={cn(
                'group rounded-xl border p-2.5 text-center transition',
                settings.accent === palette.id
                  ? 'border-espresso-900/20 bg-cream-100 ring-2 ring-espresso-900/10'
                  : 'border-line bg-white hover:bg-cream-100',
              )}
            >
              <span
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: palette.shades[600] }}
              >
                {settings.accent === palette.id && <Check className="h-4 w-4 text-white" />}
              </span>
              <span className="mt-1.5 block text-[10.5px] font-semibold text-muted">{palette.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <div className="mb-1 flex items-center gap-2">
          {settings.colorMode === 'dark'
            ? <Moon className="h-4 w-4 text-accent-foreground" />
            : settings.colorMode === 'light'
              ? <Sun className="h-4 w-4 text-accent-foreground" />
              : <Monitor className="h-4 w-4 text-accent-foreground" />}
          <h3 className="text-[15px] font-semibold tracking-tight">Default appearance</h3>
        </div>
        <p className="mb-4 text-[12px] text-muted">Choose the default theme for this store.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(['system', 'light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={settings.colorMode === mode}
              onClick={() => {
                saveColorMode(mode)
                applyColorMode(mode)
                set('colorMode', mode)
              }}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold capitalize transition',
                settings.colorMode === mode
                  ? 'border-accent-foreground/30 bg-accent-50 text-accent-foreground'
                  : 'border-line bg-white text-ink hover:bg-cream-100',
              )}
            >
              {mode === 'system' ? <Monitor className="h-4 w-4" /> : mode === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {mode}
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
