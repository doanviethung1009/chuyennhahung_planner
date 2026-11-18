/** Where an integrity finding's owning record can be opened in the admin (P07-15). */

export interface IntegrityIssue {
  entity: string;
  id: string;
  issue: string;
}

export type OwnerLink =
  | { pathname: '/admin/content/stories/[slug]'; params: { slug: string } }
  | { pathname: '/admin/content/places/[slug]'; params: { slug: string } }
  | { pathname: '/admin/content/collections/[slug]'; params: { slug: string } }
  | '/admin/content/reviews';

/**
 * Content findings link to the record's editor. A review has no per-record page
 * (the moderation queue lists them), so it links to the queue. Templates have no
 * admin page until the template CMS ships, and Planner findings name user and
 * trip records the content admin does not own, so those return null (plain text).
 */
export function ownerLink(entity: string, id: string): OwnerLink | null {
  switch (entity) {
    case 'story':
      return { pathname: '/admin/content/stories/[slug]', params: { slug: id } };
    case 'place':
      return { pathname: '/admin/content/places/[slug]', params: { slug: id } };
    case 'collection':
      return { pathname: '/admin/content/collections/[slug]', params: { slug: id } };
    case 'review':
      return '/admin/content/reviews';
    default:
      return null;
  }
}
