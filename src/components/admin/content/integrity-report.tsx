'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buttonClass } from '@/components/ui/button';
import { api } from '@/components/planner/api';
import { LiveNotice } from './notices';
import { useErrorNotice, type Notice } from './use-record';
import { ownerLink, type IntegrityIssue } from './integrity-utils';

interface Report {
  ok: boolean;
  issues: IntegrityIssue[];
}

function Section({
  id,
  title,
  path,
  linked,
}: {
  id: string;
  title: string;
  path: string;
  /** Planner findings name records the content admin cannot open, so they are plain text. */
  linked: boolean;
}) {
  const t = useTranslations('adminContent.integrity');
  const describe = useErrorNotice();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReport(await api<Report>(path));
    } catch (failure) {
      setReport(null);
      setError(describe(failure));
    }
  }, [path, describe]);

  useEffect(() => {
    // Fetch on mount; state is set after the awaited response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <section aria-labelledby={id} className="grid gap-4">
      <h2 id={id} className="font-display text-2xl text-foreground">
        {title}
      </h2>
      <LiveNotice notice={error} />
      {error ? (
        <div>
          <button type="button" onClick={() => void load()} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            {t('retry')}
          </button>
        </div>
      ) : null}
      {report === null ? (
        error ? null : (
          <p role="status" className="text-base text-foreground-muted">
            {t('loading')}
          </p>
        )
      ) : report.issues.length === 0 ? (
        <p role="status" className="rounded-md border border-border-strong bg-surface px-4 py-3 text-base text-foreground">
          {t('clean')}
        </p>
      ) : (
        <>
          <p role="status" className="text-sm text-foreground-muted">
            {t('count', { count: report.issues.length })}
          </p>
          <ul className="grid gap-3">
            {report.issues.map((issue, index) => {
              const link = linked ? ownerLink(issue.entity, issue.id) : null;
              return (
                <li key={`${issue.entity}:${issue.id}:${index}`} className="grid gap-1 rounded-md border border-border-subtle bg-surface p-4">
                  <p className="text-sm font-medium text-foreground-muted">{issue.entity}</p>
                  <p className="text-base text-foreground">
                    {link ? (
                      <Link href={link} className="inline-flex min-h-11 items-center font-medium text-primary-strong underline underline-offset-4">
                        {issue.id}
                      </Link>
                    ) : (
                      <span className="font-medium">{issue.id}</span>
                    )}
                    {' — '}
                    {issue.issue}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * Read-only integrity findings. The content report is for every editor; the
 * Planner report names user and trip ids, so it is requested only by admins
 * (`showPlanner`) and the API refuses anyone else.
 */
export function IntegrityReport({ showPlanner }: { showPlanner: boolean }) {
  const t = useTranslations('adminContent.integrity');
  return (
    <div className="grid gap-10">
      <Section id="integrity-content" title={t('contentTitle')} path="/api/admin/travel/integrity" linked />
      {showPlanner ? (
        <Section id="integrity-planner" title={t('plannerTitle')} path="/api/admin/planner/integrity" linked={false} />
      ) : null}
    </div>
  );
}
