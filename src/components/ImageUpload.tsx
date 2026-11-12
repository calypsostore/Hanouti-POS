import { useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { resizeImage } from '../lib/resizeImage'
import { useToast } from './toast'

export function ImageUpload({
  value,
  label,
  onChange,
}: {
  value?: string
  label: string
  onChange: (value: string | undefined) => void
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const selectImage = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onChange(await resizeImage(file))
      push('Image is ready to save.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not process this image.'
      setError(message)
      push(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <label className="glass-subtle flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-3 text-xs font-semibold text-ink transition hover:border-brand-amber">
          <ImagePlus className="h-4 w-4 text-muted" />
          {busy ? 'Preparing image…' : label}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              void selectImage(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        {value && (
          <>
            <img src={value} alt="" className="h-11 w-11 rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => onChange(undefined)}
              aria-label="Remove image"
              className="rounded-full p-2 text-muted hover:bg-cream-200"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs text-danger-text">{error}</p>}
      <p className="mt-1 text-[10px] text-muted">Square image, resized to 256 px and stored locally (max 300 KB).</p>
    </div>
  )
}
