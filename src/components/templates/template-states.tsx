import { ButtonLink } from '@/components/ui/button';

/** No public template: real links onward, never a dead end. */
export function TemplatesEmpty({
  title,
  body,
  storiesLabel,
  newTripLabel,
}: {
  title: string;
  body: string;
  storiesLabel: string;
  newTripLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-muted p-8 text-center">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-foreground-muted">{body}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/stories" variant="secondary">
          {storiesLabel}
        </ButtonLink>
        <ButtonLink href="/my-trips/new">{newTripLabel}</ButtonLink>
      </div>
    </div>
  );
}

/** The store could not be read. An error, not "empty"; the retry is a plain link back to this page. */
export function TemplatesError({ title, body, retryLabel }: { title: string; body: string; retryLabel: string }) {
  return (
    <div role="alert" className="rounded-xl border border-border-strong bg-surface-muted p-8 text-center">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-foreground-muted">{body}</p>
      <div className="mt-5">
        <ButtonLink href="/trip-templates" variant="secondary">
          {retryLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
