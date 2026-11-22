import { provincesWithDestinations } from '@/content/provinces';

type Raw = string | string[] | undefined;

/**
 * The `?province=` value of `/destinations`, or '' for "all". Anything that is not
 * a province holding a destination is dropped, so a bad URL shows the full list.
 */
export function parseDestinationProvince(raw: Raw): string {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
  return provincesWithDestinations.some((p) => p.slug === value) ? value : '';
}
