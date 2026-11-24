/** Presentation-only routing. The authoritative booking checks remain in useTourWizard. */
export type TourPlanningMode = 'quick' | 'custom';

export const TOUR_WIZARD_FLOW: Record<TourPlanningMode, readonly number[]> = {
  quick: [0, 3, 8], // Basics, suggested route/venues, review
  custom: [0, 1, 2, 3, 4, 5, 6, 8],
};

export function wizardFlowPosition(mode: TourPlanningMode, step: number): number {
  return Math.max(0, TOUR_WIZARD_FLOW[mode].indexOf(step));
}

export function moveTourWizard(mode: TourPlanningMode, step: number, direction: 1 | -1): number {
  const flow = TOUR_WIZARD_FLOW[mode];
  const next = Math.max(0, Math.min(flow.length - 1, wizardFlowPosition(mode, step) + direction));
  return flow[next];
}
