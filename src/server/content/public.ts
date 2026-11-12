import { cache } from "react";
import { stories as staticStories } from "@/content/stories";
import type { Story } from "@/content/types";
import { getRepository } from "./instance";
import { isContentError, type TravelContentRepository } from "./repository";
import type {
  LocalizedText,
  Place,
  StoryBlock,
  TravelReview,
  TravelStory,
  TripCost,
} from "./schemas";

/**
 * The only place public pages obtain Travel content (ADR 0012). Pages never
 * import `repository.ts` or `store.ts`. Two adapters sit behind one interface:
 * `repository` (default) and `static` (rollback and test double, reads
 * `src/content/stories.ts`). A store error rejects; there is no fallback to
 * the static seed.
 */

export interface PublicStory {
  slug: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  cover: string;
  readingMinutes: number;
  blocks: StoryBlock[];
  /** `YYYY-MM-DD` (UTC), what `formatDate` expects. */
  publishedAt: string;
  /** Full instant, for JSON-LD `datePublished`. */
  publishedAtIso: string;
  updatedAt: string;
  destinationSlugs: string[];
  plannerTemplateSlug: string | null;
  places: Place[];
  /** Published reviews only. */
  reviews: TravelReview[];
  gallery: string[];
  travelDates: { start: string; end: string };
  actualCost: TripCost | null;
  seo: {
    title: LocalizedText;
    description: LocalizedText;
    ogImage: string;
    noindex: boolean;
  };
}

export interface PublicContent {
  /** Published only, newest `publishedAt` first, slug as tiebreak. */
  listStories(): Promise<PublicStory[]>;
  /** Null for draft, archived and unknown slugs. */
  getStory(slug: string): Promise<PublicStory | null>;
  listStoriesForDestination(destinationSlug: string): Promise<PublicStory[]>;
  /** Published and not `noindex`. */
  listSitemapEntries(): Promise<{ slug: string; updatedAt: string }[]>;
}

export type PublicContentSource = "repository" | "static";

function bySlugNewest(a: PublicStory, b: PublicStory): number {
  return (
    b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug)
  );
}

function buildPublicContent(
  loadAll: () => Promise<PublicStory[]>,
  loadOne: (slug: string) => Promise<PublicStory | null>,
): PublicContent {
  return {
    async listStories() {
      return (await loadAll()).sort(bySlugNewest);
    },
    getStory: loadOne,
    async listStoriesForDestination(destinationSlug) {
      return (await loadAll())
        .filter((story) => story.destinationSlugs.includes(destinationSlug))
        .sort(bySlugNewest);
    },
    async listSitemapEntries() {
      return (await loadAll())
        .filter((story) => !story.seo.noindex)
        .sort(bySlugNewest)
        .map((story) => ({ slug: story.slug, updatedAt: story.updatedAt }));
    },
  };
}

// ---------------------------------------------------------------------------
// repository adapter
// ---------------------------------------------------------------------------

const PAGE = 100;

async function optional<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (isContentError(error) && error.code === "not_found") return null;
    throw error;
  }
}

async function toPublicStory(
  repository: TravelContentRepository,
  story: TravelStory,
): Promise<PublicStory> {
  const slugs = new Set(story.placeSlugs);
  for (const block of story.content) {
    if (block.type === "place") slugs.add(block.placeSlug);
  }
  const places: Place[] = [];
  for (const slug of slugs) {
    const place = await optional(() => repository.getPlace(slug));
    if (place) places.push(place);
    else
      console.warn(
        `public content: story "${story.slug}" references missing place "${slug}"`,
      );
  }

  const reviews: TravelReview[] = [];
  for (const id of story.reviewIds) {
    const review = await optional(() => repository.getReview(id));
    if (review?.status === "published") reviews.push(review);
  }

  // Old stored documents predate the field, so read it defensively.
  const templateSlug = story.plannerTemplateSlug ?? null;
  const template = templateSlug
    ? await optional(() => repository.getPublicTemplate(templateSlug))
    : null;

  const publishedAtIso = story.publishedAt ?? story.createdAt;
  return {
    slug: story.slug,
    title: story.title,
    excerpt: story.excerpt,
    cover: story.cover,
    readingMinutes: story.readingMinutes,
    blocks: story.content,
    publishedAt: publishedAtIso.slice(0, 10),
    publishedAtIso,
    updatedAt: story.updatedAt,
    destinationSlugs: story.destinationSlug ? [story.destinationSlug] : [],
    plannerTemplateSlug: template ? templateSlug : null,
    places,
    reviews,
    gallery: story.gallery,
    travelDates: story.travelDates,
    actualCost: story.actualCost,
    seo: {
      title: story.seo.title ?? story.title,
      description: story.seo.description,
      ogImage: story.seo.ogImage ?? story.cover,
      noindex: story.seo.noindex,
    },
  };
}

/** One read per request and slug when running under React's request scope. */
const loadPublishedStory = cache(
  async (
    repository: TravelContentRepository,
    slug: string,
  ): Promise<PublicStory | null> => {
    const story = await optional(() => repository.getStory(slug));
    if (!story || story.status !== "published") return null;
    return toPublicStory(repository, story);
  },
);

export function createRepositoryPublicContent(
  resolveRepository: () => Promise<TravelContentRepository> = getRepository,
): PublicContent {
  return buildPublicContent(
    async () => {
      const repository = await resolveRepository();
      const all: TravelStory[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const page = await repository.listStories({
          status: "published",
          limit: PAGE,
          offset,
        });
        all.push(...page);
        if (page.length < PAGE) break;
      }
      return Promise.all(all.map((story) => toPublicStory(repository, story)));
    },
    async (slug) => loadPublishedStory(await resolveRepository(), slug),
  );
}

// ---------------------------------------------------------------------------
// static adapter
// ---------------------------------------------------------------------------

function staticToPublic(story: Story): PublicStory {
  const publishedAtIso = `${story.publishedAt}T00:00:00.000Z`;
  return {
    slug: story.slug,
    title: story.title,
    excerpt: story.excerpt,
    cover: story.cover,
    readingMinutes: story.readingMinutes,
    blocks: story.body.vi.map((vi, index) => ({
      type: "paragraph" as const,
      text: { vi, en: story.body.en[index] ?? vi },
    })),
    publishedAt: story.publishedAt,
    publishedAtIso,
    updatedAt: publishedAtIso,
    destinationSlugs: [...story.destinationSlugs],
    plannerTemplateSlug: story.plannerTemplateSlug ?? null,
    places: [],
    reviews: [],
    gallery: [],
    travelDates: { start: story.publishedAt, end: story.publishedAt },
    actualCost: null,
    seo: {
      title: story.title,
      description: story.excerpt,
      ogImage: story.cover,
      noindex: false,
    },
  };
}

export function createStaticPublicContent(
  source: readonly Story[] = staticStories,
): PublicContent {
  const all = () => Promise.resolve(source.map(staticToPublic));
  return buildPublicContent(all, async (slug) => {
    const found = source.find((story) => story.slug === slug);
    return found ? staticToPublic(found) : null;
  });
}

// ---------------------------------------------------------------------------

/** Read on every call (never at import), so changing the variable needs a restart, not a rebuild. */
export function publicContentSource(): PublicContentSource {
  return process.env.PUBLIC_CONTENT_SOURCE?.trim() === "static"
    ? "static"
    : "repository";
}

export async function getPublicContent(): Promise<PublicContent> {
  return publicContentSource() === "static"
    ? createStaticPublicContent()
    : createRepositoryPublicContent();
}
