import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { formatVnd } from '@/lib/format';
import type { PublicPlace } from '@/server/content/public-places';
import type { StoryBlock } from '@/server/content/schemas';
import { CoverImage } from '@/components/ui/cover-image';

const bodyClass = 'text-lg leading-relaxed text-ink-800 md:text-[1.1875rem] md:leading-[1.75]';

/** Consecutive `cost` blocks read as one list; everything else is one block. */
type Group =
  | { kind: 'block'; block: Exclude<StoryBlock, { type: 'cost' }> }
  | { kind: 'costs'; blocks: Extract<StoryBlock, { type: 'cost' }>[] };

function group(blocks: StoryBlock[]): Group[] {
  const out: Group[] = [];
  for (const block of blocks) {
    if (block.type === 'cost') {
      const last = out[out.length - 1];
      if (last?.kind === 'costs') last.blocks.push(block);
      else out.push({ kind: 'costs', blocks: [block] });
    } else {
      out.push({ kind: 'block', block });
    }
  }
  return out;
}

/**
 * Renders the seven story block types. The page owns the only `<h1>`, so
 * heading blocks are `h2`/`h3` by schema. Place names are not headings: a
 * `place` block can sit under any heading level.
 */
export async function StoryBlocks({
  blocks,
  places,
  locale,
}: {
  blocks: StoryBlock[];
  places: PublicPlace[];
  locale: Locale;
}) {
  const t = await getTranslations('storyPage');
  const bySlug = new Map(places.map((place) => [place.slug, place]));

  return (
    <div className="flex flex-col gap-6">
      {group(blocks).map((item, index) => {
        if (item.kind === 'costs') {
          return (
            <dl
              key={index}
              aria-label={t('costsLabel')}
              className="divide-y divide-border-subtle rounded-xl bg-surface-muted px-5"
            >
              {item.blocks.map((cost, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-base text-ink-800">{cost.label[locale]}</dt>
                  <dd className="text-base font-semibold text-primary-strong">
                    {formatVnd(cost.amountVnd, locale)}
                  </dd>
                </div>
              ))}
            </dl>
          );
        }

        const block = item.block;
        switch (block.type) {
          case 'paragraph':
            return (
              <p key={index} className={bodyClass}>
                {block.text[locale]}
              </p>
            );
          case 'heading': {
            const Tag = block.level === 2 ? 'h2' : 'h3';
            return (
              <Tag
                key={index}
                className={`font-display font-semibold text-ink-900 ${
                  block.level === 2 ? 'mt-6 text-2xl md:text-3xl' : 'mt-4 text-xl md:text-2xl'
                }`}
              >
                {block.text[locale]}
              </Tag>
            );
          }
          case 'image':
            return (
              <figure key={index} className="my-2">
                <div className="relative aspect-3/2 w-full overflow-hidden rounded-xl">
                  <CoverImage
                    src={block.src}
                    alt={block.alt[locale]}
                    sizes="(max-width: 768px) 100vw, 720px"
                  />
                </div>
                {block.caption ? (
                  <figcaption className="mt-2 text-sm text-foreground-muted">
                    {block.caption[locale]}
                  </figcaption>
                ) : null}
              </figure>
            );
          case 'quote':
            return (
              <blockquote
                key={index}
                className="border-l-2 border-primary pl-5 font-display text-xl leading-relaxed text-ink-800 italic md:text-2xl"
              >
                <p>{block.text[locale]}</p>
                {block.attribution ? (
                  <footer className="mt-2 text-base text-foreground-muted not-italic">
                    {block.attribution}
                  </footer>
                ) : null}
              </blockquote>
            );
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List
                key={index}
                className={`${bodyClass} ${block.ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-6`}
              >
                {block.items[locale].map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </List>
            );
          }
          case 'place': {
            const place = bySlug.get(block.placeSlug);
            // A slug that no longer resolves is omitted, never a dead card.
            if (!place) return null;
            return (
              <PlaceCard key={index} place={place} note={block.note?.[locale] ?? null} locale={locale} t={t} />
            );
          }
        }
      })}
    </div>
  );
}

type StoryPageT = Awaited<ReturnType<typeof getTranslations<'storyPage'>>>;

export function PlaceCard({
  place,
  note,
  locale,
  t,
}: {
  place: PublicPlace;
  note: string | null;
  locale: Locale;
  t: StoryPageT;
}) {
  return (
    <aside className="rounded-xl border border-border-subtle bg-surface p-5 shadow-soft">
      <p className="font-display text-xl font-semibold text-ink-900">{place.name[locale]}</p>
      <p className="mt-1 text-sm text-foreground-muted">{place.location[locale]}</p>
      <p className="mt-3 text-sm text-foreground-muted">
        {t('placeMinutes', { minutes: place.suggestedMinutes })}
        {' · '}
        {t('placeCost', { amount: formatVnd(place.estimatedCostVnd, locale) })}
      </p>
      {note ? <p className="mt-3 text-base text-ink-800">{note}</p> : null}
    </aside>
  );
}
