import { randomUUID } from 'node:crypto';
import { destinations } from '@/content/destinations';
import { itineraries } from '@/content/itineraries';
import {
  type ContentError,
  type FieldIssue,
  invalidReference,
  invalidState,
  notFound,
  slugConflict,
  staleContent,
} from './errors';
import type { ContentData, ContentStore } from './store';
import type {
  CollectionCreateInput,
  CollectionUpdateInput,
  DestinationCollection,
  ListQuery,
  MoveActivityInput,
  Place,
  PlaceCreateInput,
  PlaceUpdateInput,
  PublishAction,
  ReorderActivitiesInput,
  ReviewCreateInput,
  ReviewUpdateInput,
  StoryCreateInput,
  StoryPlacesPatch,
  StoryUpdateInput,
  TemplateActivity,
  TemplateCreateInput,
  TemplateDay,
  TemplateDayInput,
  TemplateUpdateInput,
  TravelReview,
  TravelStory,
  TravelTemplate,
  TripCost,
} from './schemas';

export interface RepositoryOptions {
  store: ContentStore;
  /** Injected so tests get deterministic timestamps. */
  now?: () => Date;
  /** Injected so tests get deterministic activity ids. */
  newId?: () => string;
  /** Defaults to the committed seed content; overridable for isolated tests. */
  knownDestinationSlugs?: Iterable<string>;
  knownItinerarySlugs?: Iterable<string>;
}

export interface IntegrityIssue {
  entity: string;
  id: string;
  issue: string;
}

/**
 * All domain logic for the Travel Content System. It owns every cross-entity
 * invariant — the store below it only moves bytes, and the route handlers above
 * it only parse payloads and map errors to status codes.
 */
export class TravelContentRepository {
  private readonly store: ContentStore;
  private readonly now: () => Date;
  private readonly newId: () => string;
  private readonly destinationSlugs: ReadonlySet<string>;
  private readonly itinerarySlugs: ReadonlySet<string>;

  constructor(options: RepositoryOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? (() => `act_${randomUUID().slice(0, 8)}`);
    this.destinationSlugs = new Set(
      options.knownDestinationSlugs ?? destinations.map((d) => d.slug),
    );
    this.itinerarySlugs = new Set(
      options.knownItinerarySlugs ?? itineraries.map((i) => i.slug),
    );
  }

  // -------------------------------------------------------------------------
  // Transaction plumbing
  // -------------------------------------------------------------------------

  /** Read-modify-write, made atomic by the store (ADR 0008 §3). */
  private transaction<T>(mutate: (data: ContentData) => Promise<T> | T): Promise<T> {
    return this.store.transact(mutate);
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private async snapshot(): Promise<ContentData> {
    return this.store.read();
  }

  // -------------------------------------------------------------------------
  // Reference checking
  // -------------------------------------------------------------------------

  private checkDestination(slug: string | null, path: string, issues: FieldIssue[]): void {
    if (slug !== null && !this.destinationSlugs.has(slug)) {
      issues.push({ path, message: `destination "${slug}" does not exist` });
    }
  }

  private checkItineraries(slugs: string[], path: string, issues: FieldIssue[]): void {
    slugs.forEach((slug, index) => {
      if (!this.itinerarySlugs.has(slug)) {
        issues.push({
          path: `${path}[${index}]`,
          message: `itinerary "${slug}" does not exist`,
        });
      }
    });
  }

  private checkPlaces(
    data: ContentData,
    slugs: string[],
    path: string,
    issues: FieldIssue[],
  ): void {
    const known = new Set(data.places.map((p) => p.slug));
    slugs.forEach((slug, index) => {
      if (!known.has(slug)) {
        issues.push({ path: `${path}[${index}]`, message: `place "${slug}" does not exist` });
      }
    });
  }

  /**
   * Single-reference variants. The array helpers above suffix the path with an
   * index, which would be wrong for a scalar field such as `subject.ref`.
   */
  private checkPlace(
    data: ContentData,
    slug: string,
    path: string,
    issues: FieldIssue[],
  ): void {
    if (!data.places.some((p) => p.slug === slug)) {
      issues.push({ path, message: `place "${slug}" does not exist` });
    }
  }

  private checkItinerary(slug: string, path: string, issues: FieldIssue[]): void {
    if (!this.itinerarySlugs.has(slug)) {
      issues.push({ path, message: `itinerary "${slug}" does not exist` });
    }
  }

  private static raiseIf(issues: FieldIssue[]): void {
    if (issues.length > 0) throw invalidReference(issues);
  }

  // -------------------------------------------------------------------------
  // Travel Places
  // -------------------------------------------------------------------------

  async listPlaces(query: Partial<ListQuery> = {}): Promise<Place[]> {
    const data = await this.snapshot();
    let places = [...data.places];
    if (query.destinationSlug) {
      places = places.filter((p) => p.destinationSlug === query.destinationSlug);
    }
    if (query.category) {
      places = places.filter((p) => p.category === query.category);
    }
    places.sort((a, b) => a.slug.localeCompare(b.slug));
    return paginate(places, query);
  }

  async getPlace(slug: string): Promise<Place> {
    const data = await this.snapshot();
    const place = data.places.find((p) => p.slug === slug);
    if (!place) throw notFound('place', slug);
    return place;
  }

  createPlace(input: PlaceCreateInput): Promise<Place> {
    return this.transaction((data) => {
      if (data.places.some((p) => p.slug === input.slug)) {
        throw slugConflict('place', input.slug);
      }
      const issues: FieldIssue[] = [];
      this.checkDestination(input.destinationSlug, 'destinationSlug', issues);
      TravelContentRepository.raiseIf(issues);

      const at = this.timestamp();
      const place: Place = { ...input, createdAt: at, updatedAt: at };
      data.places.push(place);
      return place;
    });
  }

  updatePlace(slug: string, patch: PlaceUpdateInput, expectedUpdatedAt?: string): Promise<Place> {
    return this.transaction((data) => {
      const index = data.places.findIndex((p) => p.slug === slug);
      const existing = data.places[index];
      if (index < 0 || !existing) throw notFound('place', slug);
      checkStamp('place', existing.updatedAt, expectedUpdatedAt);

      const issues: FieldIssue[] = [];
      if (patch.destinationSlug !== undefined) {
        this.checkDestination(patch.destinationSlug, 'destinationSlug', issues);
      }
      TravelContentRepository.raiseIf(issues);

      const next: Place = { ...existing, ...patch, updatedAt: this.timestamp() };
      data.places[index] = next;
      return next;
    });
  }

  /**
   * Refuses while anything still points at the place, and names every referrer
   * — a dangling slug is worse than a failed delete.
   */
  deletePlace(slug: string): Promise<void> {
    return this.transaction((data) => {
      const index = data.places.findIndex((p) => p.slug === slug);
      if (index < 0) throw notFound('place', slug);

      const referrers = [
        ...data.stories.filter((s) => storyReferencesPlace(s, slug)).map((s) => `story:${s.slug}`),
        ...data.collections
          .filter((c) => c.placeSlugs.includes(slug))
          .map((c) => `collection:${c.slug}`),
        ...data.templates
          .filter((t) => t.placeSlugs.includes(slug))
          .map((t) => `template:${t.slug}`),
        ...data.reviews
          .filter((r) => r.subject.kind === 'place' && r.subject.ref === slug)
          .map((r) => `review:${r.id}`),
      ];
      if (referrers.length > 0) {
        throw invalidState(
          `place "${slug}" is still referenced by ${referrers.join(', ')}`,
        );
      }
      data.places.splice(index, 1);
    });
  }

  // -------------------------------------------------------------------------
  // Travel Stories
  // -------------------------------------------------------------------------

  async listStories(query: Partial<ListQuery> = {}): Promise<TravelStory[]> {
    const data = await this.snapshot();
    let stories = [...data.stories];
    if (query.status) stories = stories.filter((s) => s.status === query.status);
    if (query.destinationSlug) {
      stories = stories.filter((s) => s.destinationSlug === query.destinationSlug);
    }
    if (query.travelStyle) {
      stories = stories.filter((s) => s.travelStyle === query.travelStyle);
    }
    // Newest trip first; slug breaks ties so ordering is stable.
    stories.sort(
      (a, b) =>
        b.travelDates.start.localeCompare(a.travelDates.start) ||
        a.slug.localeCompare(b.slug),
    );
    return paginate(stories, query);
  }

  async getStory(slug: string): Promise<TravelStory> {
    const data = await this.snapshot();
    const story = data.stories.find((s) => s.slug === slug);
    if (!story) throw notFound('story', slug);
    return story;
  }

  /** Public read path: an unpublished story is a 404, not a 403. */
  async getPublishedStory(slug: string): Promise<TravelStory> {
    const story = await this.getStory(slug);
    if (story.status !== 'published') throw notFound('story', slug);
    return story;
  }

  createStory(input: StoryCreateInput): Promise<TravelStory> {
    return this.transaction((data) => {
      if (data.stories.some((s) => s.slug === input.slug)) {
        throw slugConflict('story', input.slug);
      }
      this.validateStoryReferences(data, input);

      const at = this.timestamp();
      const story: TravelStory = {
        ...input,
        status: 'draft',
        publishedAt: null,
        actualCostTotalVnd: totalFromCost(input.actualCost),
        createdAt: at,
        updatedAt: at,
      };
      data.stories.push(story);
      return story;
    });
  }

  updateStory(
    slug: string,
    patch: StoryUpdateInput,
    expectedUpdatedAt?: string,
  ): Promise<TravelStory> {
    return this.transaction((data) => {
      const index = data.stories.findIndex((s) => s.slug === slug);
      const existing = data.stories[index];
      if (index < 0 || !existing) throw notFound('story', slug);
      checkStamp('story', existing.updatedAt, expectedUpdatedAt);

      const merged = { ...existing, ...patch };
      this.validateStoryReferences(data, merged);

      const next: TravelStory = {
        ...merged,
        actualCostTotalVnd: totalFromCost(merged.actualCost),
        updatedAt: this.timestamp(),
      };
      data.stories[index] = next;
      return next;
    });
  }

  /**
   * Publish lifecycle. Publishing is gated on every linked review being public
   * too, so a live story can never link to a hidden one.
   */
  setStoryStatus(slug: string, action: PublishAction): Promise<TravelStory> {
    return this.transaction((data) => {
      const index = data.stories.findIndex((s) => s.slug === slug);
      const existing = data.stories[index];
      if (index < 0 || !existing) throw notFound('story', slug);

      let next: TravelStory;
      if (action.action === 'publish') {
        const hidden = existing.reviewIds.filter((id) => {
          const review = data.reviews.find((r) => r.id === id);
          return !review || review.status !== 'published';
        });
        if (hidden.length > 0) {
          throw invalidState(
            `cannot publish "${slug}": linked review(s) not published — ${hidden.join(', ')}`,
          );
        }
        next = {
          ...existing,
          status: 'published',
          publishedAt: action.publishedAt ?? existing.publishedAt ?? this.timestamp(),
          updatedAt: this.timestamp(),
        };
      } else if (action.action === 'unpublish') {
        // `publishedAt` is kept: re-publishing should not silently re-date a trip.
        next = { ...existing, status: 'draft', updatedAt: this.timestamp() };
      } else {
        const blocking = data.templates.filter(
          (t) => t.sourceStorySlug === slug && t.visibility === 'public',
        );
        if (blocking.length > 0) {
          throw invalidState(
            `cannot archive "${slug}": public template(s) depend on it — ${blocking
              .map((t) => t.slug)
              .join(', ')}`,
          );
        }
        next = { ...existing, status: 'archived', updatedAt: this.timestamp() };
      }

      data.stories[index] = next;
      return next;
    });
  }

  /** Add or remove related places on a story, idempotently. */
  patchStoryPlaces(
    slug: string,
    patch: StoryPlacesPatch,
    expectedUpdatedAt?: string,
  ): Promise<TravelStory> {
    return this.transaction((data) => {
      const index = data.stories.findIndex((s) => s.slug === slug);
      const existing = data.stories[index];
      if (index < 0 || !existing) throw notFound('story', slug);
      checkStamp('story', existing.updatedAt, expectedUpdatedAt);

      const issues: FieldIssue[] = [];
      this.checkPlaces(data, patch.add, 'add', issues);
      TravelContentRepository.raiseIf(issues);

      const removing = new Set(patch.remove);
      const blocked = patch.remove.filter((placeSlug) =>
        existing.content.some(
          (block) => block.type === 'place' && block.placeSlug === placeSlug,
        ),
      );
      if (blocked.length > 0) {
        throw invalidState(
          `cannot unlink ${blocked.join(', ')} from "${slug}": still embedded in the story body`,
        );
      }

      const kept = existing.placeSlugs.filter((s) => !removing.has(s));
      const placeSlugs = [...new Set([...kept, ...patch.add])];

      const next: TravelStory = {
        ...existing,
        placeSlugs,
        updatedAt: this.timestamp(),
      };
      data.stories[index] = next;
      return next;
    });
  }

  deleteStory(slug: string): Promise<void> {
    return this.transaction((data) => {
      const index = data.stories.findIndex((s) => s.slug === slug);
      const existing = data.stories[index];
      if (index < 0 || !existing) throw notFound('story', slug);
      if (existing.status === 'published') {
        throw invalidState(
          `cannot delete published story "${slug}" — unpublish or archive it first`,
        );
      }
      // Templates are NOT blocking: each holds an immutable source snapshot and
      // survives its story being deleted (ADR 0001 §4).
      data.stories.splice(index, 1);
    });
  }

  private validateStoryReferences(
    data: ContentData,
    story: Pick<
      TravelStory,
      'destinationSlug' | 'placeSlugs' | 'reviewIds' | 'itinerarySlugs' | 'content'
    >,
  ): void {
    const issues: FieldIssue[] = [];
    this.checkDestination(story.destinationSlug, 'destinationSlug', issues);
    this.checkPlaces(data, story.placeSlugs, 'placeSlugs', issues);
    this.checkItineraries(story.itinerarySlugs, 'itinerarySlugs', issues);

    const knownReviews = new Set(data.reviews.map((r) => r.id));
    story.reviewIds.forEach((id, index) => {
      if (!knownReviews.has(id)) {
        issues.push({ path: `reviewIds[${index}]`, message: `review "${id}" does not exist` });
      }
    });

    // A `place` block must resolve, and must also be declared in `placeSlugs`
    // so the two never disagree about what the story covers.
    const declared = new Set(story.placeSlugs);
    const knownPlaces = new Set(data.places.map((p) => p.slug));
    story.content.forEach((block, index) => {
      if (block.type !== 'place') return;
      if (!knownPlaces.has(block.placeSlug)) {
        issues.push({
          path: `content[${index}].placeSlug`,
          message: `place "${block.placeSlug}" does not exist`,
        });
      } else if (!declared.has(block.placeSlug)) {
        issues.push({
          path: `content[${index}].placeSlug`,
          message: `place "${block.placeSlug}" is embedded but missing from placeSlugs`,
        });
      }
    });

    TravelContentRepository.raiseIf(issues);
  }

  // -------------------------------------------------------------------------
  // Destination Collections
  // -------------------------------------------------------------------------

  async listCollections(query: Partial<ListQuery> = {}): Promise<DestinationCollection[]> {
    const data = await this.snapshot();
    let collections = [...data.collections];
    if (query.status) collections = collections.filter((c) => c.status === query.status);
    if (query.destinationSlug) {
      collections = collections.filter((c) =>
        c.destinationSlugs.includes(query.destinationSlug as string),
      );
    }
    collections.sort((a, b) => a.slug.localeCompare(b.slug));
    return paginate(collections, query);
  }

  async getCollection(slug: string): Promise<DestinationCollection> {
    const data = await this.snapshot();
    const collection = data.collections.find((c) => c.slug === slug);
    if (!collection) throw notFound('collection', slug);
    return collection;
  }

  async getPublishedCollection(slug: string): Promise<DestinationCollection> {
    const collection = await this.getCollection(slug);
    if (collection.status !== 'published') throw notFound('collection', slug);
    return collection;
  }

  createCollection(input: CollectionCreateInput): Promise<DestinationCollection> {
    return this.transaction((data) => {
      if (data.collections.some((c) => c.slug === input.slug)) {
        throw slugConflict('collection', input.slug);
      }
      this.validateCollectionReferences(data, input);

      const at = this.timestamp();
      const collection: DestinationCollection = {
        ...input,
        status: 'draft',
        publishedAt: null,
        createdAt: at,
        updatedAt: at,
      };
      data.collections.push(collection);
      return collection;
    });
  }

  updateCollection(
    slug: string,
    patch: CollectionUpdateInput,
  ): Promise<DestinationCollection> {
    return this.transaction((data) => {
      const index = data.collections.findIndex((c) => c.slug === slug);
      const existing = data.collections[index];
      if (index < 0 || !existing) throw notFound('collection', slug);

      const merged = { ...existing, ...patch };
      this.validateCollectionReferences(data, merged);

      const next: DestinationCollection = { ...merged, updatedAt: this.timestamp() };
      data.collections[index] = next;
      return next;
    });
  }

  setCollectionStatus(
    slug: string,
    action: PublishAction,
  ): Promise<DestinationCollection> {
    return this.transaction((data) => {
      const index = data.collections.findIndex((c) => c.slug === slug);
      const existing = data.collections[index];
      if (index < 0 || !existing) throw notFound('collection', slug);

      if (action.action === 'publish') {
        const hidden = existing.storySlugs.filter((storySlug) => {
          const story = data.stories.find((s) => s.slug === storySlug);
          return !story || story.status !== 'published';
        });
        if (hidden.length > 0) {
          throw invalidState(
            `cannot publish collection "${slug}": story/stories not published — ${hidden.join(', ')}`,
          );
        }
      }

      const status =
        action.action === 'publish'
          ? 'published'
          : action.action === 'unpublish'
            ? 'draft'
            : 'archived';
      const next: DestinationCollection = {
        ...existing,
        status,
        publishedAt:
          status === 'published'
            ? (action.publishedAt ?? existing.publishedAt ?? this.timestamp())
            : existing.publishedAt,
        updatedAt: this.timestamp(),
      };
      data.collections[index] = next;
      return next;
    });
  }

  deleteCollection(slug: string): Promise<void> {
    return this.transaction((data) => {
      const index = data.collections.findIndex((c) => c.slug === slug);
      const existing = data.collections[index];
      if (index < 0 || !existing) throw notFound('collection', slug);
      if (existing.status === 'published') {
        throw invalidState(
          `cannot delete published collection "${slug}" — unpublish or archive it first`,
        );
      }
      data.collections.splice(index, 1);
    });
  }

  private validateCollectionReferences(
    data: ContentData,
    collection: Pick<
      DestinationCollection,
      'destinationSlugs' | 'storySlugs' | 'placeSlugs'
    >,
  ): void {
    const issues: FieldIssue[] = [];
    collection.destinationSlugs.forEach((slug, index) => {
      this.checkDestination(slug, `destinationSlugs[${index}]`, issues);
    });
    this.checkPlaces(data, collection.placeSlugs, 'placeSlugs', issues);

    const knownStories = new Set(data.stories.map((s) => s.slug));
    collection.storySlugs.forEach((slug, index) => {
      if (!knownStories.has(slug)) {
        issues.push({ path: `storySlugs[${index}]`, message: `story "${slug}" does not exist` });
      }
    });
    TravelContentRepository.raiseIf(issues);
  }

  // -------------------------------------------------------------------------
  // Travel Reviews
  // -------------------------------------------------------------------------

  async listReviews(query: Partial<ListQuery> = {}): Promise<TravelReview[]> {
    const data = await this.snapshot();
    let reviews = [...data.reviews];
    if (query.status) reviews = reviews.filter((r) => r.status === query.status);
    reviews.sort(
      (a, b) => b.visitedOn.localeCompare(a.visitedOn) || a.id.localeCompare(b.id),
    );
    return paginate(reviews, query);
  }

  async getReview(id: string): Promise<TravelReview> {
    const data = await this.snapshot();
    const review = data.reviews.find((r) => r.id === id);
    if (!review) throw notFound('review', id);
    return review;
  }

  createReview(input: ReviewCreateInput): Promise<TravelReview> {
    return this.transaction((data) => {
      if (data.reviews.some((r) => r.id === input.id)) {
        throw slugConflict('review', input.id);
      }
      this.validateReviewSubject(data, input.subject);

      const at = this.timestamp();
      const review: TravelReview = {
        ...input,
        status: 'draft',
        publishedAt: null,
        createdAt: at,
        updatedAt: at,
      };
      data.reviews.push(review);
      return review;
    });
  }

  updateReview(
    id: string,
    patch: ReviewUpdateInput,
    expectedUpdatedAt?: string,
  ): Promise<TravelReview> {
    return this.transaction((data) => {
      const index = data.reviews.findIndex((r) => r.id === id);
      const existing = data.reviews[index];
      if (index < 0 || !existing) throw notFound('review', id);
      checkStamp('review', existing.updatedAt, expectedUpdatedAt);

      const merged = { ...existing, ...patch };
      this.validateReviewSubject(data, merged.subject);

      const next: TravelReview = { ...merged, updatedAt: this.timestamp() };
      data.reviews[index] = next;
      return next;
    });
  }

  setReviewStatus(id: string, action: PublishAction): Promise<TravelReview> {
    return this.transaction((data) => {
      const index = data.reviews.findIndex((r) => r.id === id);
      const existing = data.reviews[index];
      if (index < 0 || !existing) throw notFound('review', id);

      if (action.action !== 'publish') {
        // Taking a review down would strand a published story that links it.
        const linked = data.stories.filter(
          (s) => s.status === 'published' && s.reviewIds.includes(id),
        );
        if (linked.length > 0) {
          throw invalidState(
            `cannot ${action.action} review "${id}": published story/stories link it — ${linked
              .map((s) => s.slug)
              .join(', ')}`,
          );
        }
      }

      const status =
        action.action === 'publish'
          ? 'published'
          : action.action === 'unpublish'
            ? 'draft'
            : 'archived';
      const next: TravelReview = {
        ...existing,
        status,
        publishedAt:
          status === 'published'
            ? (action.publishedAt ?? existing.publishedAt ?? this.timestamp())
            : existing.publishedAt,
        updatedAt: this.timestamp(),
      };
      data.reviews[index] = next;
      return next;
    });
  }

  deleteReview(id: string): Promise<void> {
    return this.transaction((data) => {
      const index = data.reviews.findIndex((r) => r.id === id);
      if (index < 0) throw notFound('review', id);

      const linked = data.stories.filter((s) => s.reviewIds.includes(id));
      if (linked.length > 0) {
        throw invalidState(
          `review "${id}" is still linked by story/stories ${linked
            .map((s) => s.slug)
            .join(', ')}`,
        );
      }
      data.reviews.splice(index, 1);
    });
  }

  private validateReviewSubject(
    data: ContentData,
    subject: TravelReview['subject'],
  ): void {
    const issues: FieldIssue[] = [];
    if (subject.kind === 'destination') {
      this.checkDestination(subject.ref, 'subject.ref', issues);
    } else if (subject.kind === 'itinerary') {
      this.checkItinerary(subject.ref, 'subject.ref', issues);
    } else {
      this.checkPlace(data, subject.ref, 'subject.ref', issues);
    }
    TravelContentRepository.raiseIf(issues);
  }

  // -------------------------------------------------------------------------
  // Reusable Travel Templates
  // -------------------------------------------------------------------------

  async listTemplates(query: Partial<ListQuery> = {}): Promise<TravelTemplate[]> {
    const data = await this.snapshot();
    let templates = [...data.templates];
    if (query.visibility) {
      templates = templates.filter((t) => t.visibility === query.visibility);
    }
    if (query.travelStyle) {
      templates = templates.filter((t) => t.travelStyle === query.travelStyle);
    }
    if (query.destinationSlug) {
      templates = templates.filter(
        (t) => t.sourceSnapshot.destinationSlug === query.destinationSlug,
      );
    }
    templates.sort((a, b) => a.slug.localeCompare(b.slug));
    return paginate(templates, query);
  }

  async getTemplate(slug: string): Promise<TravelTemplate> {
    const data = await this.snapshot();
    const template = data.templates.find((t) => t.slug === slug);
    if (!template) throw notFound('template', slug);
    return template;
  }

  async getPublicTemplate(slug: string): Promise<TravelTemplate> {
    const template = await this.getTemplate(slug);
    if (template.visibility !== 'public') throw notFound('template', slug);
    return template;
  }

  /**
   * Cuts a reusable template from a real trip. The source story is snapshotted
   * immutably at this moment; later edits to that story never reach back in.
   */
  createTemplate(input: TemplateCreateInput): Promise<TravelTemplate> {
    return this.transaction((data) => {
      if (data.templates.some((t) => t.slug === input.slug)) {
        throw slugConflict('template', input.slug);
      }

      const source = data.stories.find((s) => s.slug === input.sourceStorySlug);
      if (!source) {
        throw invalidReference([
          {
            path: 'sourceStorySlug',
            message: `story "${input.sourceStorySlug}" does not exist`,
          },
        ]);
      }

      const issues: FieldIssue[] = [];
      this.checkItineraries(input.itinerarySlugs, 'itinerarySlugs', issues);
      collectActivityPlaceSlugs(input.days).forEach(({ slug, path }) => {
        this.checkPlace(data, slug, path, issues);
      });
      TravelContentRepository.raiseIf(issues);

      if (input.visibility === 'public' && source.status !== 'published') {
        throw invalidState(
          `cannot create a public template from unpublished story "${source.slug}"`,
        );
      }

      const at = this.timestamp();
      const days = this.buildDays(input.days);
      const template: TravelTemplate = {
        slug: input.slug,
        sourceStorySlug: input.sourceStorySlug,
        title: input.title,
        summary: input.summary,
        travelStyle: input.travelStyle,
        pace: input.pace,
        groupSize: input.groupSize,
        itinerarySlugs: input.itinerarySlugs,
        visibility: input.visibility,
        days,
        durationDays: days.length,
        placeSlugs: derivePlaceSlugs(days),
        estimatedTotalVnd: deriveTotalVnd(days),
        version: 1,
        sourceSnapshot: {
          storySlug: source.slug,
          title: source.title,
          destinationSlug: source.destinationSlug,
          travelDates: { ...source.travelDates },
          actualCostTotalVnd: source.actualCostTotalVnd,
          placeSlugs: [...source.placeSlugs],
          storyUpdatedAt: source.updatedAt,
          snapshotTakenAt: at,
        },
        createdAt: at,
        updatedAt: at,
      };
      data.templates.push(template);
      return template;
    });
  }

  /**
   * Replacing `days` wholesale re-issues activity ids — ordering changes should
   * go through `reorderActivities` / `moveActivity`, which preserve them.
   */
  updateTemplate(slug: string, patch: TemplateUpdateInput): Promise<TravelTemplate> {
    return this.transaction((data) => {
      const index = data.templates.findIndex((t) => t.slug === slug);
      const existing = data.templates[index];
      if (index < 0 || !existing) throw notFound('template', slug);

      const issues: FieldIssue[] = [];
      if (patch.itinerarySlugs !== undefined) {
        this.checkItineraries(patch.itinerarySlugs, 'itinerarySlugs', issues);
      }
      if (patch.days !== undefined) {
        collectActivityPlaceSlugs(patch.days).forEach(({ slug: placeSlug, path }) => {
          this.checkPlace(data, placeSlug, path, issues);
        });
      }
      TravelContentRepository.raiseIf(issues);

      if (patch.visibility === 'public') {
        const source = data.stories.find((s) => s.slug === existing.sourceStorySlug);
        if (!source || source.status !== 'published') {
          throw invalidState(
            `cannot publish template "${slug}": source story is not published`,
          );
        }
      }

      const days = patch.days ? this.buildDays(patch.days) : existing.days;
      const next: TravelTemplate = {
        ...existing,
        ...patch,
        days,
        durationDays: days.length,
        placeSlugs: derivePlaceSlugs(days),
        estimatedTotalVnd: deriveTotalVnd(days),
        version: existing.version + 1,
        // The snapshot is immutable by design and is never merged from a patch.
        sourceSnapshot: existing.sourceSnapshot,
        updatedAt: this.timestamp(),
      };
      data.templates[index] = next;
      return next;
    });
  }

  /** Reorder activities within one day. The payload must be a permutation. */
  reorderActivities(
    slug: string,
    input: ReorderActivitiesInput,
  ): Promise<TravelTemplate> {
    return this.transaction((data) => {
      const index = data.templates.findIndex((t) => t.slug === slug);
      const existing = data.templates[index];
      if (index < 0 || !existing) throw notFound('template', slug);

      const day = existing.days.find((d) => d.day === input.day);
      if (!day) throw notFound(`template "${slug}" day`, String(input.day));

      const currentIds = day.activities.map((a) => a.id);
      const requested = input.activityIds;
      if (new Set(requested).size !== requested.length) {
        throw invalidState('activityIds contains a duplicate');
      }
      const sameSet =
        requested.length === currentIds.length &&
        requested.every((id) => currentIds.includes(id));
      if (!sameSet) {
        throw invalidState(
          `activityIds must be a permutation of day ${input.day}'s activities (${currentIds.join(', ')})`,
        );
      }

      const byId = new Map(day.activities.map((a) => [a.id, a]));
      const reordered: TemplateActivity[] = requested.map((id, position) => {
        const activity = byId.get(id);
        if (!activity) throw invalidState(`unknown activity "${id}"`);
        return { ...activity, order: position };
      });

      const days = existing.days.map((d) =>
        d.day === input.day ? { ...d, activities: reordered } : d,
      );
      const next: TravelTemplate = {
        ...existing,
        days,
        placeSlugs: derivePlaceSlugs(days),
        estimatedTotalVnd: deriveTotalVnd(days),
        version: existing.version + 1,
        updatedAt: this.timestamp(),
      };
      data.templates[index] = next;
      return next;
    });
  }

  /** Move one activity to another day, or to a new index within its own day. */
  moveActivity(slug: string, input: MoveActivityInput): Promise<TravelTemplate> {
    return this.transaction((data) => {
      const index = data.templates.findIndex((t) => t.slug === slug);
      const existing = data.templates[index];
      if (index < 0 || !existing) throw notFound('template', slug);

      const target = existing.days.find((d) => d.day === input.toDay);
      if (!target) throw notFound(`template "${slug}" day`, String(input.toDay));

      const source = existing.days.find((d) =>
        d.activities.some((a) => a.id === input.activityId),
      );
      const activity = source?.activities.find((a) => a.id === input.activityId);
      if (!source || !activity) {
        throw notFound(`template "${slug}" activity`, input.activityId);
      }
      if (source.day === input.toDay && source.activities.length === 1) {
        throw invalidState(`day ${source.day} would be left with no activities`);
      }
      if (source.day !== input.toDay && source.activities.length === 1) {
        throw invalidState(
          `cannot move the only activity out of day ${source.day} — a day must keep at least one`,
        );
      }

      const days = existing.days.map((day) => {
        if (day.day === source.day && day.day === input.toDay) {
          const without = day.activities.filter((a) => a.id !== input.activityId);
          without.splice(clampIndex(input.toIndex, without.length), 0, activity);
          return { ...day, activities: renumber(without) };
        }
        if (day.day === source.day) {
          return {
            ...day,
            activities: renumber(day.activities.filter((a) => a.id !== input.activityId)),
          };
        }
        if (day.day === input.toDay) {
          const next = [...day.activities];
          next.splice(clampIndex(input.toIndex, next.length + 1), 0, activity);
          return { ...day, activities: renumber(next) };
        }
        return day;
      });

      const next: TravelTemplate = {
        ...existing,
        days,
        placeSlugs: derivePlaceSlugs(days),
        estimatedTotalVnd: deriveTotalVnd(days),
        version: existing.version + 1,
        updatedAt: this.timestamp(),
      };
      data.templates[index] = next;
      return next;
    });
  }

  deleteTemplate(slug: string): Promise<void> {
    return this.transaction((data) => {
      const index = data.templates.findIndex((t) => t.slug === slug);
      const existing = data.templates[index];
      if (index < 0 || !existing) throw notFound('template', slug);
      if (existing.visibility === 'public') {
        throw invalidState(
          `cannot delete public template "${slug}" — set it private first`,
        );
      }
      data.templates.splice(index, 1);
    });
  }

  private buildDays(dayInputs: TemplateDayInput[]): TemplateDay[] {
    return dayInputs.map((day, dayIndex) => ({
      day: dayIndex + 1,
      title: day.title,
      summary: day.summary,
      activities: day.activities.map((activity, order) => ({
        ...activity,
        id: this.newId(),
        order,
      })),
    }));
  }

  // -------------------------------------------------------------------------
  // Integrity sweep — catches a hand-edited JSON file
  // -------------------------------------------------------------------------

  async validateIntegrity(): Promise<IntegrityIssue[]> {
    const data = await this.snapshot();
    const issues: IntegrityIssue[] = [];
    const placeSlugs = new Set(data.places.map((p) => p.slug));
    const storySlugs = new Set(data.stories.map((s) => s.slug));
    const reviewIds = new Set(data.reviews.map((r) => r.id));

    const report = (entity: string, id: string, issue: string) =>
      issues.push({ entity, id, issue });

    for (const place of data.places) {
      if (!this.destinationSlugs.has(place.destinationSlug)) {
        report('place', place.slug, `unknown destination "${place.destinationSlug}"`);
      }
    }
    for (const story of data.stories) {
      if (story.destinationSlug !== null && !this.destinationSlugs.has(story.destinationSlug)) {
        report('story', story.slug, `unknown destination "${story.destinationSlug}"`);
      }
      for (const slug of story.placeSlugs) {
        if (!placeSlugs.has(slug)) report('story', story.slug, `unknown place "${slug}"`);
      }
      for (const id of story.reviewIds) {
        if (!reviewIds.has(id)) report('story', story.slug, `unknown review "${id}"`);
      }
      for (const slug of story.itinerarySlugs) {
        if (!this.itinerarySlugs.has(slug)) {
          report('story', story.slug, `unknown itinerary "${slug}"`);
        }
      }
      if (story.actualCostTotalVnd !== totalFromCost(story.actualCost)) {
        report('story', story.slug, 'actualCostTotalVnd disagrees with the breakdown');
      }
      if (story.status === 'published' && story.publishedAt === null) {
        report('story', story.slug, 'published with no publishedAt');
      }
    }
    for (const collection of data.collections) {
      for (const slug of collection.destinationSlugs) {
        if (!this.destinationSlugs.has(slug)) {
          report('collection', collection.slug, `unknown destination "${slug}"`);
        }
      }
      for (const slug of collection.storySlugs) {
        if (!storySlugs.has(slug)) {
          report('collection', collection.slug, `unknown story "${slug}"`);
        }
      }
      for (const slug of collection.placeSlugs) {
        if (!placeSlugs.has(slug)) {
          report('collection', collection.slug, `unknown place "${slug}"`);
        }
      }
    }
    for (const review of data.reviews) {
      const { kind, ref } = review.subject;
      const resolved =
        kind === 'place'
          ? placeSlugs.has(ref)
          : kind === 'destination'
            ? this.destinationSlugs.has(ref)
            : this.itinerarySlugs.has(ref);
      if (!resolved) report('review', review.id, `unknown ${kind} "${ref}"`);
    }
    for (const template of data.templates) {
      for (const slug of template.placeSlugs) {
        if (!placeSlugs.has(slug)) {
          report('template', template.slug, `unknown place "${slug}"`);
        }
      }
      if (template.durationDays !== template.days.length) {
        report('template', template.slug, 'durationDays disagrees with days.length');
      }
      if (template.estimatedTotalVnd !== deriveTotalVnd(template.days)) {
        report('template', template.slug, 'estimatedTotalVnd disagrees with activity costs');
      }
      const dayNumbers = template.days.map((d) => d.day);
      const expected = Array.from({ length: template.days.length }, (_, i) => i + 1);
      if (dayNumbers.join(',') !== expected.join(',')) {
        report('template', template.slug, 'days are not numbered 1..n');
      }
      for (const day of template.days) {
        const orders = day.activities.map((a) => a.order);
        const wanted = Array.from({ length: day.activities.length }, (_, i) => i);
        if (orders.join(',') !== wanted.join(',')) {
          report('template', template.slug, `day ${day.day} activity order has a gap`);
        }
      }
      // The snapshot is immutable, so a deleted source story is expected and
      // is reported as information rather than corruption.
      if (!storySlugs.has(template.sourceStorySlug)) {
        report('template', template.slug, `source story "${template.sourceStorySlug}" no longer exists (snapshot retained)`);
      }
    }
    return issues;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Optimistic concurrency inside the transaction: no stamp = last write wins. */
function checkStamp(entity: string, actual: string, expected: string | undefined): void {
  if (expected !== undefined && expected !== actual) {
    throw staleContent(entity, actual);
  }
}

function paginate<T>(items: T[], query: Partial<ListQuery>): T[] {
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  return items.slice(offset, offset + limit);
}

/** Totals are always recomputed from the breakdown, never taken on trust. */
export function totalFromCost(cost: TripCost | null | undefined): number | null {
  if (!cost) return null;
  return cost.breakdown.reduce((sum, line) => sum + line.amountVnd, 0);
}

export function deriveTotalVnd(days: TemplateDay[]): number {
  return days.reduce(
    (total, day) =>
      total + day.activities.reduce((sum, a) => sum + a.estimatedCostVnd, 0),
    0,
  );
}

/** Unique place slugs in first-appearance order across every day. */
export function derivePlaceSlugs(days: TemplateDay[]): string[] {
  const seen = new Set<string>();
  for (const day of days) {
    for (const activity of day.activities) {
      if (activity.placeSlug) seen.add(activity.placeSlug);
    }
  }
  return [...seen];
}

function collectActivityPlaceSlugs(
  days: TemplateDayInput[],
): { slug: string; path: string }[] {
  const found: { slug: string; path: string }[] = [];
  days.forEach((day, dayIndex) => {
    day.activities.forEach((activity, activityIndex) => {
      if (activity.placeSlug) {
        found.push({
          slug: activity.placeSlug,
          path: `days[${dayIndex}].activities[${activityIndex}].placeSlug`,
        });
      }
    });
  });
  return found;
}

function renumber(activities: TemplateActivity[]): TemplateActivity[] {
  return activities.map((activity, order) => ({ ...activity, order }));
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, Math.max(0, length - 1)));
}

export function isContentError(error: unknown): error is ContentError {
  return error instanceof Error && error.name === 'ContentError';
}

/** A story references a place either by declaration or by an embedded block. */
function storyReferencesPlace(story: TravelStory, placeSlug: string): boolean {
  return (
    story.placeSlugs.includes(placeSlug) ||
    story.content.some(
      (block) => block.type === 'place' && block.placeSlug === placeSlug,
    )
  );
}
