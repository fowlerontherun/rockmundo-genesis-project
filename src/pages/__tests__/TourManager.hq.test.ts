import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manager = readFileSync('src/pages/TourManager.tsx', 'utf8');
const details = readFileSync('src/components/tours/TourDetailPanel.tsx', 'utf8');

describe('Tour HQ', () => {
  it('provides one destination for overview, dates, support and operations', () => {
    for (const section of ['overview', 'dates', 'support', 'operations']) {
      expect(manager).toContain(`<TabsTrigger value="${section}"`);
      expect(manager).toContain(`<TabsContent value="${section}"`);
    }
    expect(manager).toContain('Open Tour HQ');
    expect(manager).toContain("openTourDetails(tour, 'support')");
    expect(manager).not.toContain('<BookedTourSupportDialog');
  });

  it('keeps financials, maps, support consent and travel operations intact', () => {
    expect(details).toContain("section === 'overview'");
    expect(details).toContain("section === 'support'");
    expect(details).toContain("section === 'operations'");
    for (const preserved of ['TourSupportPanel', 'TourOperationsCommandCenter', 'LiveTourHQPanel', 'TourMemberSyncStatus', 'TravelTimelineLog']) {
      expect(details).toContain(preserved);
    }
    expect(manager).toContain('<TourRouteMap points={routePoints} />');
    expect(manager).toContain('cancelTour.mutate(selectedTour.id');
    expect(manager).toContain('regenerateTravelLegs.mutate(selectedTour.id)');
  });
});
