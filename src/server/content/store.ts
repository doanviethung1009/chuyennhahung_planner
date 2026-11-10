import {
  createJsonDocumentStore,
  createMemoryDocumentStore,
  type DocumentStore,
} from '@/server/persistence/json-store';
import type {
  DestinationCollection,
  Place,
  TravelReview,
  TravelStory,
  TravelTemplate,
} from './schemas';

/**
 * The whole content set, as one document. Persistence is deliberately behind
 * the `DocumentStore` interface: swapping in SQL later is a new
 * adapter and nothing else (see `docs/adr/0001-travel-content-system.md` §1).
 */
export interface ContentData {
  places: Place[];
  stories: TravelStory[];
  collections: DestinationCollection[];
  reviews: TravelReview[];
  templates: TravelTemplate[];
}

export type ContentStore = DocumentStore<ContentData>;

export function emptyContentData(): ContentData {
  return { places: [], stories: [], collections: [], reviews: [], templates: [] };
}

/** Fills in any collection a partial or hand-edited file is missing. */
function normalize(partial: Partial<ContentData>): ContentData {
  return {
    places: partial.places ?? [],
    stories: partial.stories ?? [],
    collections: partial.collections ?? [],
    reviews: partial.reviews ?? [],
    templates: partial.templates ?? [],
  };
}

export function createMemoryStore(initial: ContentData = emptyContentData()): ContentStore {
  return createMemoryDocumentStore(initial);
}

export function createJsonFileStore(filePath: string): ContentStore {
  return createJsonDocumentStore(filePath, normalize);
}
