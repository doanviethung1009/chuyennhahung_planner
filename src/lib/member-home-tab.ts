/**
 * The tabs of the member home (`/my-trips`, ADR 0032). The tab is a `?tab=`
 * query read on the server: a link, not client state. Anything that is not one
 * of the constants below (missing, unknown) is the default tab; a repeated parameter uses its first value — the
 * raw value is never echoed into the page, a URL or a log.
 */
export const MEMBER_HOME_TABS = ['trips', 'map', 'share'] as const;
export type MemberHomeTab = (typeof MEMBER_HOME_TABS)[number];
export const DEFAULT_MEMBER_HOME_TAB: MemberHomeTab = 'trips';

export function parseMemberHomeTab(raw: string | string[] | undefined): MemberHomeTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return MEMBER_HOME_TABS.find((tab) => tab === value) ?? DEFAULT_MEMBER_HOME_TAB;
}
