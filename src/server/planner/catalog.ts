import { destinations } from '@/content/destinations';
import type { TravelContentRepository } from '@/server/content/repository';
import type { Place, TravelTemplate } from '@/server/content/schemas';

/**
 * The Planner's read-only window onto the Travel Content System.
 *
 * It is an interface rather than a direct dependency for two reasons. It states
 * exactly what the Planner may do with editorial content — look three things up,
 * write nothing — so "cloning a template must not modify the template" is
 * guaranteed by the shape of the dependency instead of by discipline. And it
 * lets the Planner's tests run against a handful of fixtures rather than a
 * fully seeded content store.
 */
export interface PlannerCatalog {
  hasDestination(slug: string): boolean;
  getPlace(slug: string): Promise<Place | null>;
  /** Only an *approved* (public) template may be cloned — a draft is invisible. */
  getApprovedTemplate(slug: string): Promise<TravelTemplate | null>;
}

export function createContentCatalog(
  content: TravelContentRepository,
  knownDestinationSlugs: Iterable<string> = destinations.map((d) => d.slug),
): PlannerCatalog {
  const destinationSlugs = new Set(knownDestinationSlugs);

  return {
    hasDestination(slug) {
      return destinationSlugs.has(slug);
    },
    async getPlace(slug) {
      try {
        return await content.getPlace(slug);
      } catch {
        return null;
      }
    },
    async getApprovedTemplate(slug) {
      try {
        return await content.getPublicTemplate(slug);
      } catch {
        return null;
      }
    },
  };
}
