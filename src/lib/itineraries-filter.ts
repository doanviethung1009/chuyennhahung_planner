import { destinations } from '@/content/destinations';
import { itineraries } from '@/content/itineraries';
import { provinces } from '@/content/provinces';
import type { Itinerary, Province } from '@/content/types';

type Raw = string | string[] | undefined;

/** Provinces an itinerary passes through: those of the destinations it lists. */
export function itineraryProvinceSlugs(itinerary: Itinerary): string[] {
  const slugs = new Set<string>();
  for (const slug of itinerary.destinationSlugs) {
    const d = destinations.find((x) => x.slug === slug);
    if (d) slugs.add(d.provinceSlug);
  }
  return [...slugs];
}

/** Provinces at least one itinerary passes through, in `provinces` order — the only ones worth offering. */
export const provincesWithItineraries: Province[] = provinces.filter((p) =>
  itineraries.some((i) => itineraryProvinceSlugs(i).includes(p.slug)),
);

/** The `?province=` value of `/itineraries`, or '' for "all". Unknown or empty-result values are dropped. */
export function parseItineraryProvince(raw: Raw): string {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
  return provincesWithItineraries.some((p) => p.slug === value) ? value : '';
}

export function itinerariesInProvince(provinceSlug: string): Itinerary[] {
  return provinceSlug
    ? itineraries.filter((i) => itineraryProvinceSlugs(i).includes(provinceSlug))
    : itineraries;
}
