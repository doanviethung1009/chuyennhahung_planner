import type { ReactNode } from 'react';
import { Container } from '@/components/ui/container';

/**
 * Compact title row for every admin page (ADR 0023): renders the page's single
 * h1, an optional one-line description and an optional actions slot, with a
 * hairline below. It replaces the public hero `PageHeader` inside the admin.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border-subtle">
      <Container width="wide">
        <div className="flex flex-col gap-4 py-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-base text-foreground-muted">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      </Container>
    </div>
  );
}
