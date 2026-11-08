import type { ComponentProps, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { Container } from './container';

type Tone = 'default' | 'muted';

const tones: Record<Tone, string> = {
  default: '',
  muted: 'bg-surface-muted',
};

/**
 * A homepage/landing band. Every section is a real <section> with its heading
 * wired through `aria-labelledby`, so the page outline is navigable.
 */
export function Section({
  id,
  children,
  tone = 'default',
  className = '',
  labelledBy,
}: {
  id?: string;
  children: ReactNode;
  tone?: Tone;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`py-14 md:py-20 lg:py-24 ${tones[tone]} ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
  headingId,
  action,
  align = 'start',
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  headingId: string;
  action?: { href: ComponentProps<typeof Link>['href']; label: string };
  align?: 'start' | 'center';
}) {
  const centered = align === 'center';

  return (
    <div
      className={`mb-8 flex flex-col gap-4 md:mb-12 ${
        centered
          ? 'items-center text-center'
          : 'md:flex-row md:items-end md:justify-between'
      }`}
    >
      <div className={`max-w-2xl ${centered ? '' : 'flex-1'}`}>
        {eyebrow ? (
          <p className="text-eyebrow mb-3 text-primary-strong">{eyebrow}</p>
        ) : null}
        <h2
          id={headingId}
          className="text-3xl leading-tight font-semibold md:text-4xl lg:text-[2.75rem]"
        >
          {title}
        </h2>
        {lead ? (
          <p className="mt-4 text-base text-foreground-muted md:text-lg">{lead}</p>
        ) : null}
      </div>

      {action ? (
        <Link
          href={action.href}
          className="group inline-flex min-h-11 shrink-0 items-center gap-2 self-start font-medium text-primary-strong md:self-auto"
        >
          {action.label}
          <span
            aria-hidden="true"
            className="transition-transform duration-200 ease-gentle group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      ) : null}
    </div>
  );
}

export { Container };
