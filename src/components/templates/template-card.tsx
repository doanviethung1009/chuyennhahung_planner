import { Link } from '@/i18n/navigation';
import { Badge, MetaRow } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button';

/** Everything the card shows, already translated and formatted by the page (no async translation here). */
export interface TemplateCardLabels {
  title: string;
  summary: string;
  duration: string;
  style: string;
  pace: string;
  group: string;
  cost: string;
  destination: string | null;
  useCta: string;
  /** Screen-reader-only tail of the link name, e.g. "for <title>"; translated by the page. */
  useCtaFor: string;
  paceLabel: string;
  groupLabel: string;
  costLabel: string;
}

/** A text-only card: templates carry no image. One link only, to the setup page for this template. */
export function TemplateCard({ slug, labels }: { slug: string; labels: TemplateCardLabels }) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-xl bg-surface p-5 shadow-soft md:p-6">
      <div>
        <Badge tone="accent">{labels.style}</Badge>
      </div>
      <h2 className="text-xl leading-snug font-semibold text-balance">{labels.title}</h2>
      <MetaRow items={[labels.duration, labels.destination]} />
      <p className="leading-relaxed text-foreground-muted">{labels.summary}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-foreground-muted">{labels.paceLabel}</dt>
        <dd>{labels.pace}</dd>
        <dt className="text-foreground-muted">{labels.groupLabel}</dt>
        <dd>{labels.group}</dd>
        <dt className="text-foreground-muted">{labels.costLabel}</dt>
        <dd>{labels.cost}</dd>
      </dl>
      <div className="mt-auto pt-2">
        <Link
          href={{ pathname: '/trip-setup/[template]', params: { template: slug } }}
          className={buttonClass({ size: 'md' })}
        >
          {labels.useCta}
          <span className="sr-only"> {labels.useCtaFor}</span>
        </Link>
      </div>
    </article>
  );
}
