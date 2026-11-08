import type { ReactNode } from 'react';
import { Container } from '@/components/ui/container';

/** Standard masthead for every non-home page. Renders the page's single h1. */
export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-border-subtle bg-surface-muted">
      <Container width="wide">
        <div className="max-w-3xl py-12 md:py-16 lg:py-20">
          {eyebrow ? (
            <p className="text-eyebrow mb-3 text-primary-strong">{eyebrow}</p>
          ) : null}
          <h1 className="font-display text-[2.25rem] leading-[1.1] font-semibold tracking-tight md:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-5 text-lg leading-relaxed text-foreground-muted">
              {description}
            </p>
          ) : null}
          {meta ? <div className="mt-6">{meta}</div> : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </Container>
    </div>
  );
}
