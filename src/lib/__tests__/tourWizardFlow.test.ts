import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { moveTourWizard, TOUR_WIZARD_FLOW, wizardFlowPosition } from '../tourWizardFlow';

describe('tour creation flow', () => {
  it('offers three Quick Tour checkpoints and always finishes at the same review step', () => {
    expect(TOUR_WIZARD_FLOW.quick).toEqual([0, 3, 8]);
    expect(moveTourWizard('quick', 0, 1)).toBe(3);
    expect(moveTourWizard('quick', 3, 1)).toBe(8);
    expect(moveTourWizard('quick', 8, -1)).toBe(3);
    expect(wizardFlowPosition('quick', 8)).toBe(2);
  });

  it('retains all eight existing customizable steps without the retired support step', () => {
    expect(TOUR_WIZARD_FLOW.custom).toEqual([0, 1, 2, 3, 4, 5, 6, 8]);
    for (let i = 0; i < TOUR_WIZARD_FLOW.custom.length - 1; i++) {
      expect(moveTourWizard('custom', TOUR_WIZARD_FLOW.custom[i], 1)).toBe(TOUR_WIZARD_FLOW.custom[i + 1]);
    }
    expect(moveTourWizard('custom', 8, 1)).toBe(8);
    expect(moveTourWizard('custom', 0, -1)).toBe(0);
  });

  it('does not create shortcuts past the authoritative venue and budget validations', () => {
    const wizard = readFileSync('src/components/tours/TourWizard.tsx', 'utf8');
    const hook = readFileSync('src/hooks/useTourWizard.ts', 'utf8');
    expect(wizard).toContain('disabled={!wizard.canProceed}');
    expect(wizard).toContain('wizard.bookTour(');
    expect(hook).toContain('venueMatches.length === requestedShowCount');
    expect(hook).toContain('(band?.band_balance || 0) >= costEstimate.netUpfrontCost');
    expect(hook).toContain('routeValidationError: routeCitiesError || venuesError');
  });
});
