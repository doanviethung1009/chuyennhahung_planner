import type { ReactNode } from 'react';

type Tone = 'neutral' | 'primary' | 'accent';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-foreground-muted border-border-subtle',
  primary: 'bg-clay-300/25 text-clay-700 border-clay-300/60',
  accent: 'bg-jade-500/15 text-jade-600 border-jade-500/30',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-3 py-1 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Small meta row used under card titles (date · reading time · region). */
export function MetaRow({
  items,
  className = '',
}: {
  items: ReactNode[];
  className?: string;
}) {
  const shown = items.filter(Boolean);

  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground-muted ${className}`}
    >
      {shown.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 ? (
            <span aria-hidden="true" className="text-ink-300">
              ·
            </span>
          ) : null}
          {item}
        </span>
      ))}
    </p>
  );
}
