import type { ComponentProps, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-soft hover:bg-primary-strong active:translate-y-px',
  secondary:
    'bg-surface text-foreground border border-border-strong hover:border-primary hover:text-primary-strong',
  ghost: 'text-primary-strong hover:bg-surface-muted',
};

/** Sizes keep every control at or above the 44px touch-target minimum. */
const sizes: Record<Size, string> = {
  sm: 'min-h-11 px-4 text-sm',
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-13 px-7 text-base md:text-lg',
};

export function buttonClass({
  variant = 'primary',
  size = 'md',
  className = '',
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-pill font-medium',
    'transition-colors duration-200 ease-gentle',
    variants[variant],
    sizes[size],
    className,
  ].join(' ');
}

interface Shared {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

/** Internal navigation. Locale and localized pathname are handled by next-intl. */
export function ButtonLink({
  href,
  children,
  variant,
  size,
  className,
}: Shared & { href: ComponentProps<typeof Link>['href'] }) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })}>
      {children}
    </Link>
  );
}

/**
 * Off-site navigation. Always announces the new tab to screen readers, since a
 * sighted user gets that cue from the browser and a screen-reader user does not.
 */
export function ButtonExternalLink({
  href,
  children,
  variant,
  size,
  className,
  newTabLabel,
}: Shared & { href: string; newTabLabel: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass({ variant, size, className })}
    >
      {children}
      <span className="sr-only">{newTabLabel}</span>
    </a>
  );
}
