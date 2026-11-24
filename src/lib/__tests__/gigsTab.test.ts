import { describe, expect, it } from 'vitest';
import { DEFAULT_GIGS_TAB, GIGS_TABS, resolveGigsTab } from '@/lib/gigsTab';

describe('gigs screen default panel', () => {
  it('opens on Upcoming Gigs when the player arrives without a panel in the link', () => {
    expect(DEFAULT_GIGS_TAB).toBe('upcoming');
    expect(resolveGigsTab(null)).toBe('upcoming');
    expect(resolveGigsTab('')).toBe('upcoming');
  });

  it('ignores a panel name the gigs screen does not have', () => {
    expect(resolveGigsTab('offers')).toBe('upcoming');
    expect(resolveGigsTab('BOOK')).toBe('upcoming');
    expect(resolveGigsTab('upcoming ')).toBe('upcoming');
  });

  it('still honours links that name a panel so bookmarks and notifications land correctly', () => {
    GIGS_TABS.forEach((tab) => {
      expect(resolveGigsTab(tab)).toBe(tab);
    });
    expect(resolveGigsTab('book')).toBe('book');
    expect(resolveGigsTab('history')).toBe('history');
    expect(resolveGigsTab('play-together')).toBe('play-together');
  });
});
