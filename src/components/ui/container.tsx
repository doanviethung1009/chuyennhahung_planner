import type { ReactNode } from 'react';

type Width = 'default' | 'narrow' | 'wide';

const widths: Record<Width, string> = {
  narrow: 'max-w-2xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
};

/** The single source of horizontal rhythm: 20px gutter on mobile, 32px from md. */
export function Container({
  children,
  width = 'default',
  className = '',
}: {
  children: ReactNode;
  width?: Width;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full px-5 md:px-8 ${widths[width]} ${className}`}>
      {children}
    </div>
  );
}
