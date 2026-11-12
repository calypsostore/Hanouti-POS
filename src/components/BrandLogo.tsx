import { BRAND_NAME } from '../lib/brand'
import { cn } from '../lib/utils'
import logoImage from '../../logo/logo1.png'

type BrandLogoSize = 'sm' | 'md' | 'lg'
type BrandLogoVariant = 'auto' | 'light' | 'dark'

const sizes: Record<BrandLogoSize, { image: string; word: string }> = {
  sm: { image: 'h-12 w-12', word: 'text-[15px]' },
  md: { image: 'h-16 w-16', word: 'text-[18px]' },
  lg: { image: 'h-24 w-24', word: 'text-[24px]' },
}

export function BrandLogo({
  size = 'md',
  variant = 'auto',
  markOnly = false,
  className,
}: {
  size?: BrandLogoSize
  variant?: BrandLogoVariant
  markOnly?: boolean
  className?: string
}) {
  const name = BRAND_NAME.replace('-POS', '')
  return (
    <span
      className={cn('inline-flex items-center gap-2.5', className)}
      role="img"
      aria-label={BRAND_NAME}
    >
      <img src={logoImage} alt="" aria-hidden="true" className={cn('shrink-0 object-contain', sizes[size].image)} />
      {!markOnly && (
        <span
          className={cn(
            'font-extrabold leading-none tracking-tight',
            sizes[size].word,
            variant === 'dark' ? 'text-white' : variant === 'auto' ? 'brand-logo-auto text-brand-navy' : 'text-brand-navy',
          )}
        >
          {name}<span className="text-brand-amber">.</span>
          <span className="ml-1 font-bold">POS</span>
        </span>
      )}
    </span>
  )
}
