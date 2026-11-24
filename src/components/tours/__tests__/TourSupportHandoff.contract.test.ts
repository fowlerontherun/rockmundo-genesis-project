import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manager = readFileSync('src/pages/TourManager.tsx', 'utf8');
const wizard = readFileSync('src/components/tours/TourWizard.tsx', 'utf8');
const support = readFileSync('src/components/tours/TourSupportPanel.tsx', 'utf8');

describe('post-booking support handoff', () => {
  it('prompts after a successful persisted tour and never creates invitations automatically', () => {
    expect(wizard).toContain('onSuccess: (tour) =>');
    expect(wizard).toContain('onComplete?.({ id: tour.id, name: tour.name })');
    expect(manager).toContain('setNewTourSupportPrompt(tour)');
    expect(manager).toContain('Would you like to invite eligible support acts');
    expect(manager).toContain("I'll do this later");
    expect(manager).toContain('setNewTourSupportFinderOpen(true)');
  });

  it('keeps consent and eligibility in the existing saved-tour proposal workflow', () => {
    expect(manager).toContain('tourStatus="scheduled"');
    expect(support).toContain('createTourProposal(headlinerBandId, tourId, selectedBandId, gigIds');
    expect(support).toContain('row.travel_feasible');
    expect(support).toContain('blockedGigIds.has(row.gig_id)');
    expect(support).toContain('20% of artist ticket revenue');
  });
});
