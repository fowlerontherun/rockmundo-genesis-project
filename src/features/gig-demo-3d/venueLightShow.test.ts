// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { disposeModel } from '@/features/player-model/model';
import { buildVenueProduction, productionLayout, stageLightPositions } from './venueProduction';
import { planVenueLighting, venueBeamCue } from './venueLightShow';
import { resolveVenueProfile, VENUE_TYPES, type VenueKind } from './venueProfile';

const label = () => new T.Mesh(new T.PlaneGeometry(1, .3), new T.MeshBasicMaterial());

describe('physical production and playable light-show budgets', () => {
  const examples = [
    ['street_corner', 40, 2, 0],
    ['dive_bar', 150, 4, 0],
    ['live_house', 900, 8, 4],
    ['indoor_arena', 10000, 8, 8],
    ['stadium', 65000, 8, 16],
  ] as const;

  it.each(examples)('%s with %i fans supports %i physical spotlights plus %i haze beams', (kind, capacity, spotlights, extra) => {
    const p = resolveVenueProfile({ type: kind, capacity });
    const positions = stageLightPositions(p);
    const plan = planVenueLighting(p, positions, productionLayout(p).tier, 'high');
    expect(plan.fixtureCount).toBe(positions.length);
    expect(plan.physicalSpotlightCount).toBe(spotlights);
    expect(plan.spotlightIndices).toHaveLength(spotlights);
    expect(plan.supplementaryBeamIndices).toHaveLength(extra);
    expect(plan.activeBeamCount).toBe(Math.min(4, spotlights) + extra);
    expect(new Set([...plan.spotlightIndices, ...plan.supplementaryBeamIndices]).size).toBe(spotlights + extra);
    expect([...plan.spotlightIndices, ...plan.supplementaryBeamIndices].every(index => index >= 0 && index < positions.length)).toBe(true);
  });

  it.each(Object.keys(VENUE_TYPES) as VenueKind[])('%s uses real available fixture positions without duplicates', kind => {
    const p = resolveVenueProfile({ type: kind });
    const positions = stageLightPositions(p);
    const tier = productionLayout(p).tier;
    const low = planVenueLighting(p, positions, tier, 'low');
    const balanced = planVenueLighting(p, positions, tier, 'balanced');
    const high = planVenueLighting(p, positions, tier, 'high');
    expect(low.activeBeamCount).toBeLessThanOrEqual(4);
    expect(balanced.activeBeamCount).toBeLessThanOrEqual(10);
    expect(high.activeBeamCount).toBeLessThanOrEqual(20);
    expect(low.activeBeamCount).toBeLessThanOrEqual(balanced.activeBeamCount);
    expect(balanced.activeBeamCount).toBeLessThanOrEqual(high.activeBeamCount);
    expect(low.spotlightIndices).toEqual(high.spotlightIndices);
    expect(high.supplementaryBeamIndices).toEqual(balanced.supplementaryBeamIndices);
    expect(high.spotlightIndices.length).toBeLessThanOrEqual(8);
    expect([...high.spotlightIndices, ...high.supplementaryBeamIndices].every(i => positions[i].every(Number.isFinite))).toBe(true);
  });

  it('keeps a stadium rig at 4, 10 and 20 beams as quality changes without reallocating fixtures', () => {
    const p = resolveVenueProfile({ type: 'stadium' });
    const positions = stageLightPositions(p);
    const tier = productionLayout(p).tier;
    expect(['low', 'balanced', 'high'].map(quality =>
      planVenueLighting(p, positions, tier, quality as 'low' | 'balanced' | 'high').activeBeamCount,
    )).toEqual([4, 10, 20]);
    expect(planVenueLighting(null, [], 2, 'low').physicalSpotlightCount).toBe(8);
  });

  it('colors alternate fixture banks independently without growing shader material count per fixture', () => {
    const p = resolveVenueProfile({ type: 'stadium' }), scene = new T.Scene();
    const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'SHOCKMASTER');
    const groups = new Set<string>();
    root.traverse(object => {
      if (object instanceof T.Mesh && !Array.isArray(object.material)) {
        const name = object.material.name;
        if (name.startsWith('production-light-lens-')) groups.add(name);
      }
    });
    expect([...groups].sort()).toEqual([
      'production-light-lens-key', 'production-light-lens-left', 'production-light-lens-right',
    ]);
    expect(root.getObjectByName('production-light-55')).toBeDefined();
    disposeModel(scene);
  });
});

describe('deterministic, bounded venue lighting cues', () => {
  it('replays exactly the same beams at the same saved gig time and seed', () => {
    const p = resolveVenueProfile({ type: 'stadium', seed: 934 });
    const pos: [number, number, number] = [p.stageWidth * .35, p.rigHeight - .4, .1];
    expect(venueBeamCue(p, pos, 5, 47.25, 1, false)).toEqual(venueBeamCue(p, pos, 5, 47.25, 1, false));
    expect(venueBeamCue(p, pos, 5, 47.25, 1, false)).not.toEqual(venueBeamCue(p, pos, 5, 47.35, 1, false));
    expect(venueBeamCue(p, pos, 5, 47.25, 1, false)).not.toEqual(venueBeamCue(resolveVenueProfile({ type: 'stadium', seed: 135 }), pos, 5, 47.25, 1, false));
  });

  it('freezes beam movement for reduced-motion viewers without hiding the stage', () => {
    const p = resolveVenueProfile({ type: 'indoor_arena', seed: 202 }), pos: [number, number, number] = [5, p.rigHeight, -3];
    const opening = venueBeamCue(p, pos, 3, 0, .8, true);
    expect(venueBeamCue(p, pos, 3, 80, .8, true)).toEqual(opening);
    expect(opening.opacity).toBeGreaterThan(0);
  });

  it('clamps targets within the actual stage and never outputs invalid coordinates', () => {
    for (const type of ['live_house', 'indoor_arena', 'stadium', 'festival_stage'] as const) {
      const p = resolveVenueProfile({ type });
      const positions = stageLightPositions(p);
      for (const seconds of [0, 5, 60, 240, Number.NaN]) {
        for (const energy of [-4, 0, .8, 10, Number.NaN]) {
          for (const [index, position] of positions.entries()) {
            const cue = venueBeamCue(p, position, index, seconds, energy, false);
            expect(cue.target.every(Number.isFinite)).toBe(true);
            expect(Math.abs(cue.target[0])).toBeLessThanOrEqual(p.stageWidth * .41 + .001);
            expect(cue.target[2]).toBeGreaterThan(.65 - p.stageDepth);
            expect(cue.target[2]).toBeLessThan(.65);
            expect(cue.opacity).toBeGreaterThan(0);
            expect(cue.opacity).toBeLessThanOrEqual(.0521);
          }
        }
      }
    }
  });
});
