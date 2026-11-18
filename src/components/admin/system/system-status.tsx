import { getTranslations } from 'next-intl/server';
import type { DomainStatus, SystemStatus } from '@/server/admin/system';

const card = 'rounded-md border border-border-subtle bg-surface p-5';
const dl = 'mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-2 text-sm';

type T = Awaited<ReturnType<typeof getTranslations<'adminSystem'>>>;

function Row({ label, children, tone }: { label: string; children: React.ReactNode; tone?: 'bad' | 'good' }) {
  // The state is always spelled out in words; colour only reinforces it.
  const colour = tone === 'bad' ? 'text-danger' : tone === 'good' ? 'text-primary-strong' : '';
  return (
    <>
      <dt className="text-foreground-muted">{label}</dt>
      <dd className={`min-w-0 font-medium break-words ${colour}`}>{children}</dd>
    </>
  );
}

function Domain({ name, status, t }: { name: string; status: DomainStatus; t: T }) {
  const db = {
    ok: [t('dbOk'), 'good'],
    unreachable: [t('dbUnreachable'), 'bad'],
    not_applicable: [t('dbNotApplicable'), undefined],
  } as const;
  const [dbText, dbTone] = db[status.database];
  return (
    <section aria-labelledby={`sys-${name}`} className={card}>
      <h3 id={`sys-${name}`} className="text-base font-semibold">
        {name}
      </h3>
      <dl className={dl}>
        <Row label={t('store')}>{status.store === 'postgres' ? t('storePostgres') : t('storeFile')}</Row>
        <Row label={t('database')} tone={dbTone}>
          {dbText}
        </Row>
        <Row label={t('lastMigration')}>{status.lastMigration ?? t('none')}</Row>
      </dl>
    </section>
  );
}

/** Read-only panels for the allow-listed `SystemStatus`. No action buttons by design. */
export async function SystemStatusView({ status }: { status: SystemStatus }) {
  const t = await getTranslations('adminSystem');
  const flag = (on: boolean) => (on ? t('present') : t('absent'));
  const { integrations: i } = status;
  return (
    <div className="grid gap-8">
      <section aria-labelledby="sys-stores" className="grid gap-4">
        <h2 id="sys-stores" className="text-xl font-semibold">
          {t('storesHeading')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Domain name={t('planner')} status={status.planner} t={t} />
          <Domain name={t('content')} status={status.content} t={t} />
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="sys-build" className={card}>
          <h2 id="sys-build" className="text-xl font-semibold">
            {t('buildHeading')}
          </h2>
          <dl className={dl}>
            <Row label={t('version')}>{status.build.version}</Row>
            <Row label={t('buildId')}>{status.build.buildId ?? t('unknown')}</Row>
          </dl>
        </section>
        <section aria-labelledby="sys-health" className={card}>
          <h2 id="sys-health" className="text-xl font-semibold">
            {t('healthHeading')}
          </h2>
          <dl className={dl}>
            <Row label={t('health')} tone={status.health === 'ok' ? 'good' : 'bad'}>
              {status.health === 'ok' ? t('healthOk') : t('healthFailed')}
            </Row>
          </dl>
        </section>
      </div>
      <section aria-labelledby="sys-integrations" className={card}>
        <h2 id="sys-integrations" className="text-xl font-semibold">
          {t('integrationsHeading')}
        </h2>
        <dl className={dl}>
          <Row label={t('googleSignIn')}>{flag(i.googleSignIn)}</Row>
          <Row label={t('adminApiToken')}>{flag(i.adminApiToken)}</Row>
          <Row label={t('siteUrl')}>{flag(i.siteUrl)}</Row>
          <Row label={t('publicContentSource')}>
            {i.publicContentSource === 'static' ? t('sourceStatic') : t('sourceRepository')}
          </Row>
        </dl>
      </section>
      <section aria-labelledby="sys-backups" className={card}>
        <h2 id="sys-backups" className="text-xl font-semibold">
          {t('backupsHeading')}
        </h2>
        <p className="mt-3 text-sm">{t('backups')}</p>
      </section>
    </div>
  );
}
