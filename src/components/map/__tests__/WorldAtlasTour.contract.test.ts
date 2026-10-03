import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const map = readFileSync('src/components/map/InteractiveWorldMap.tsx', 'utf8');
const atlas = readFileSync('src/components/map/WorldAtlas.tsx', 'utf8');
const wizard = readFileSync('src/hooks/useTourWizard.ts', 'utf8');
const manager = readFileSync('src/pages/TourManager.tsx', 'utf8');

describe('World Atlas tour integration contract', () => {
  it('passes unfiltered city coordinates to the globe while filtering visible pins', () => {
    expect(atlas).toContain('routeCities={cities}');
    expect(map).toContain('(routeCities ?? cities).find');
    expect(map).toContain("activeMap.off('style.load', updateRoute)");
  });

  it('does not silently drop unbookable map stops', () => {
    expect(wizard).toContain('findUnmatchedRouteStops(routeCityIds, venueMatches)');
    expect(wizard).toContain('missingRouteCityIds.length === 0');
    expect(wizard).toContain('routeCitiesLoading || venuesLoading');
  });

  it('clears a previously imported route when creating a regular tour', () => {
    expect(manager).toContain('setDraftRouteCityIds([]); setWizardOpen(true);');
    expect(manager).toContain('if (!open) setDraftRouteCityIds([])');
  });
});
