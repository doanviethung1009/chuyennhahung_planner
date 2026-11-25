'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Container } from '@/components/ui/container';
import { EMPTY_COUNTS, sectionId, visibleSections, type SectionCounts, type SectionKey } from './workspace-model';

type Context = { counts: SectionCounts; setCount: (key: SectionKey, count: number | null) => void };

const WorkspaceContext = createContext<Context | null>(null);

/** Holds the per-section counts the queues report; read-only for everything except the queues. */
export function ModerationWorkspace({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<SectionCounts>(EMPTY_COUNTS);
  const setCount = useCallback((key: SectionKey, count: number | null) => {
    setCounts((current) => (current[key] === count ? current : { ...current, [key]: count }));
  }, []);
  const value = useMemo(() => ({ counts, setCount }), [counts, setCount]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** A queue calls this with the length of the list it shows (`null` while loading). Outside a workspace it does nothing. */
export function useReportCount(key: SectionKey, count: number | null) {
  const context = useContext(WorkspaceContext);
  const setCount = context?.setCount;
  useEffect(() => {
    setCount?.(key, count);
  }, [setCount, key, count]);
}

/** Jump links to each section with its live count, in reading order. */
export function WorkspaceNav({ canRestrict }: { canRestrict: boolean }) {
  const t = useTranslations('adminCommunity.workspace');
  const context = useContext(WorkspaceContext);
  return (
    <nav aria-label={t('navLabel')} className="border-b border-border-subtle bg-surface-muted">
      <Container width="wide">
      <ul className="flex flex-wrap gap-2 py-3">
        {visibleSections(canRestrict, context?.counts.reviews ?? 0).map((key) => {
          const count = context?.counts[key] ?? null;
          return (
            <li key={key}>
              <a
                href={`#${sectionId(key)}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                {t(`nav.${key}`)}
                {count === null ? null : (
                  <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-xs" aria-label={t('countLabel', { count })}>
                    {count}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
      </Container>
    </nav>
  );
}
