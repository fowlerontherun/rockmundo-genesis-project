// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { disposeModel } from '@/features/player-model/model';
import { buildVenueProduction, productionLayout } from './venueProduction';
import { resolveVenueProfile, VENUE_TYPES, type VenueKind } from './venueProfile';
import { resolveVenueShowPlan } from './venueShowIdentity';

const label = () => new T.Mesh(new T.PlaneGeometry(1, .3), new T.MeshBasicMaterial());

describe('capacity-aware venue identity', () => {
  it('distinguishes venue architecture without changing venue capacity or the studio set', () => {
    const stadium = resolveVenueProfile({ type: 'stadium', capacity: 65000 });
    const theatre = resolveVenueProfile({ type: 'theatre', capacity: 2000 });
    const festival = resolveVenueProfile({ type: 'festival_stage', capacity: 20000 });
    const studio = resolveVenueProfile({ type: 'tv_studio' });
    const stadiumPlan = resolveVenueShowPlan(stadium, productionLayout(stadium).tier);
    const theatrePlan = resolveVenueShowPlan(theatre, productionLayout(theatre).tier);
    const festivalPlan = resolveVenueShowPlan(festival, productionLayout(festival).tier);
    const studioPlan = resolveVenueShowPlan(studio, productionLayout(studio).tier);

    expect(stadiumPlan.identity).toBe('stadium');
    expect(stadiumPlan.wingVideoTotems).toBe(2);
    expect(stadiumPlan.hasVideoFascia).toBe(true);
    expect(stadiumPlan.hasWeatherValance).toBe(true);
    expect(theatrePlan.identity).toBe('heritage');
    expect(theatrePlan.wingVideoTotems).toBe(0);
    expect(theatrePlan.hasCrowdBarrier).toBe(false);
    expect(festivalPlan.identity).toBe('festival');
    expect(festivalPlan.hasCrowdBarrier).toBe(true);
    expect(studioPlan.identity).toBe('broadcast');
    expect(studioPlan.lightingBattenCount).toBe(0);
    expect(studioPlan.frontFasciaPanels).toBe(0);
  });

  it('adds proportionally more stage panels, flown battens and video totems at large capacities', () => {
    const kinds = ['rock_club', 'live_house', 'indoor_arena', 'stadium'] as const;
    const capacities = [150, 1000, 12000, 65000];
    const plans = kinds.map((kind, i) => {
      const p = resolveVenueProfile({ type: kind, capacity: capacities[i] });
      return resolveVenueShowPlan(p, productionLayout(p).tier);
    });

    expect(plans.map(plan => plan.frontFasciaPanels)).toEqual([0, 8, 10, 12]);
    expect(plans.map(plan => plan.lightingBattenCount)).toEqual([0, 4, 8, 12]);
    expect(plans.map(plan => plan.wingVideoTotems)).toEqual([0, 0, 1, 2]);
    expect(plans[2].hasScreenSafetyRig).toBe(true);
    expect(plans[3].hasScreenSafetyRig).toBe(true);
  });

  it.each(Object.keys(VENUE_TYPES) as VenueKind[])('%s has finite, shared production geometry and an inspectable identity', kind => {
    const p = resolveVenueProfile({ type: kind });
    const scene = new T.Scene();
    const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'BAND');
    const plan = resolveVenueShowPlan(p, productionLayout(p).tier);
    const identity = root.getObjectByName('venue-show-identity-' + kind);
    expect(identity?.userData.showPlan).toEqual(plan);
    if (kind !== 'tv_studio') {
      expect(root.getObjectByName('venue-stage-fascia')).toBeDefined();
      if (plan.lightingBattenCount)
        expect(root.getObjectByName('venue-production-battens')).toBeDefined();
      if (plan.hasScreenSafetyRig) {
        expect(root.getObjectByName('venue-screen-support-rigging')?.userData.supportedScreens).toBe(2);
        expect(root.getObjectByName('stage-side-screen-1')).toBeDefined();
        expect(root.getObjectByName('stage-side-screen--1')).toBeDefined();
      }
      if (plan.hasCrowdBarrier)
        expect(root.getObjectByName('venue-front-crowd-barriers')).toBeDefined();
      if (plan.hasWeatherValance)
        expect(root.getObjectByName('venue-weatherproof-stage-valance')).toBeDefined();
    } else {
      expect(root.getObjectByName('venue-production-battens')).toBeUndefined();
    }
    let draws = 0;
    root.traverse(node => {
      if (node instanceof T.Mesh) {
        draws++;
        expect(node.matrixWorld.elements.every(Number.isFinite)).toBe(true);
      }
    });
    // Prevent additional decorative geometry from ballooning wide-view draw calls.
    expect(draws).toBeLessThan(450);
    disposeModel(scene);
  });

  it('keeps stadium barriers clear of the centre runway and attaches shared LED emission', () => {
    const stadium = resolveVenueProfile({ type: 'stadium', capacity: 65000 });
    const scene = new T.Scene();
    const root = buildVenueProduction(scene, stadium, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'BAND');
    expect(root.getObjectByName('venue-front-crowd-barriers')?.userData.runwayGap).toBeGreaterThanOrEqual(3.2);
    expect(root.getObjectByName('venue-video-totems')?.userData.count).toBe(4);
    const screen = root.getObjectByName('stage-side-screen-1-display') as T.Mesh;
    expect(screen).toBeDefined();
    const material = screen.material as T.MeshStandardMaterial;
    expect(material.map).toBe(material.emissiveMap);
    const bounds = new T.Box3().setFromObject(root);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-.01);
    expect(bounds.max.y).toBeLessThan(stadium.rigHeight + 2);
    disposeModel(scene);
  });

  it('uses the same static stage dressing for replaying the same venue', () => {
    const p = resolveVenueProfile({ type: 'festival_stage', capacity: 20000, seed: 74 });
    const build = () => {
      const scene = new T.Scene();
      const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'BAND');
      const identity = root.getObjectByName('venue-show-identity-festival_stage');
      const signature = JSON.stringify(identity?.userData.showPlan);
      const extents = new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray();
      disposeModel(scene);
      return { signature, extents };
    };
    expect(build()).toEqual(build());
  });
});
