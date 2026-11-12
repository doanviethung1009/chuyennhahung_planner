import type { Localized } from "@/content/types";
import { destinations } from "@/content/destinations";
import {
  createRepositoryPublicContent,
  createStaticPublicContent,
  publicContentSource,
} from "@/server/content/public";
import type { TravelContentRepository } from "@/server/content/repository";
import type { Place, TravelTemplate } from "@/server/content/schemas";

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
  /** The site story whose `plannerTemplateSlug` is this template, if any. */
  getLinkedStory(
    templateSlug: string,
  ): Promise<{ slug: string; title: Localized<string> } | null>;
}

type SiteStory = {
  slug: string;
  title: Localized<string>;
  plannerTemplateSlug?: string | null;
};

/**
 * Default story source: the public read module (ADR 0012 decision 9), over the
 * same repository the catalog was given, honouring `PUBLIC_CONTENT_SOURCE`. Only
 * published stories are linked, so a draft is never attributed.
 */
function defaultSiteStories(
  content: TravelContentRepository,
): () => Promise<SiteStory[]> {
  return () =>
    (publicContentSource() === "static"
      ? createStaticPublicContent()
      : createRepositoryPublicContent(() => Promise.resolve(content))
    ).listStories();
}

export function createContentCatalog(
  content: TravelContentRepository,
  knownDestinationSlugs: Iterable<string> = destinations.map((d) => d.slug),
  siteStories:
    | ReadonlyArray<SiteStory>
    | (() => Promise<ReadonlyArray<SiteStory>>) = defaultSiteStories(content),
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
    async getLinkedStory(templateSlug) {
      const list =
        typeof siteStories === "function" ? await siteStories() : siteStories;
      const story = list.find((s) => s.plannerTemplateSlug === templateSlug);
      return story ? { slug: story.slug, title: story.title } : null;
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
