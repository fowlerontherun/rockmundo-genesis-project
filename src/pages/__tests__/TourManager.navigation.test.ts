import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/pages/TourManager.tsx', 'utf8');

describe('Tour Manager simplified navigation', () => {
  it('exposes three task-focused sections instead of six separate tour tabs', () => {
    const tabValues = [...source.matchAll(/<TabsTrigger value="([^"]+)"/g)].map(match => match[1]);
    expect(tabValues).toEqual(['my-tours', 'explore', 'play-together']);
    expect(source).toContain("searchParams.get('tab') === 'play-together'");
    for (const value of tabValues) {
      expect(source).toContain(`<TabsContent value="${value}"`);
    }
  });

  it('keeps all tour statuses, the map, booking entry points and support access', () => {
    for (const label of [
      'Active tours', 'Upcoming tours', 'Tour history',
      'WorldAtlas', 'Other bands on tour', 'Create Tour',
      'SupportMarketplacePanel', 'BookedTourSupportDialog',
    ]) {
      expect(source).toContain(label);
    }
    expect(source).toContain('myToursError');
    expect(source).toContain('retryMyTours()');
    expect(source).toContain('otherToursError');
    expect(source).toContain('retryOtherTours()');
  });
});
