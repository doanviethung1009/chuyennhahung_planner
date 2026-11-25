import { destinations } from '@/content/destinations';

/** A destination as a picker needs it: the slug the API stores and its names. */
export interface DestinationOption {
  slug: string;
  name: { vi: string; en: string };
}

/**
 * Light projection of the destination list (no body text), for a server page to
 * hand to a client form as a prop; importing `destinations` itself in a client
 * component would ship every story paragraph in the bundle.
 */
export function destinationOptions(): DestinationOption[] {
  return destinations.map(({ slug, name }) => ({ slug, name: { vi: name.vi, en: name.en } }));
}
