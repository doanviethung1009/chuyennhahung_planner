import { getRepository } from './instance';
import type { TravelContentRepository } from './repository';
import type { LocalizedText, TravelTemplate } from './schemas';

/**
 * Public read of the reusable trip templates (P04-4). The interface below is the
 * allow-list of fields the public list page may show: no source story, snapshot,
 * version, timestamps, visibility or day/activity data. Declared explicitly so a
 * field added to `TravelTemplate` later does not reach the page by itself.
 */
export interface PublicTemplateCard {
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  durationDays: number;
  travelStyle: TravelTemplate['travelStyle'];
  pace: TravelTemplate['pace'];
  groupSize: LocalizedText;
  estimatedTotalVnd: number;
  /** Only used to look up the destination's display name; may be null. */
  destinationSlug: string | null;
}

/** Built field by field — never a spread. */
export function toPublicTemplateCard(template: TravelTemplate): PublicTemplateCard {
  return {
    slug: template.slug,
    title: template.title,
    summary: template.summary,
    durationDays: template.durationDays,
    travelStyle: template.travelStyle,
    pace: template.pace,
    groupSize: template.groupSize,
    estimatedTotalVnd: template.estimatedTotalVnd,
    destinationSlug: template.sourceSnapshot.destinationSlug,
  };
}

/** Same cap as the public API's maximum page size. */
const MAX_TEMPLATES = 100;

/**
 * Public templates, projected, ordered by slug. "Public" is `visibility === 'public'`
 * — the same rule as `/trip-setup/[template]`. The filter lives here, not at the call
 * site. A store failure rejects; the caller decides how to show it (never as "empty").
 */
export async function listPublicTemplates(repository?: TravelContentRepository): Promise<PublicTemplateCard[]> {
  const repo = repository ?? (await getRepository());
  const templates = await repo.listTemplates({ visibility: 'public', limit: MAX_TEMPLATES, offset: 0 });
  return templates.map(toPublicTemplateCard);
}
