/**
 * Which gigs screen panel a player lands on.
 *
 * Gigs open on the schedule: what the band is playing next matters more than
 * the venue browser, so an unlabelled visit shows Upcoming Gigs. Explicit
 * links (?tab=...) still win so bookmarks, notifications and share links keep
 * taking players exactly where they expected.
 */

export const GIGS_TABS = ['book', 'upcoming', 'history', 'play-together'] as const;

export const DEFAULT_GIGS_TAB = 'upcoming';

export type GigsTab = (typeof GIGS_TABS)[number];

export const resolveGigsTab = (requested: string | null): GigsTab => {
  if (requested && (GIGS_TABS as readonly string[]).includes(requested)) {
    return requested as GigsTab;
  }
  return DEFAULT_GIGS_TAB;
};
