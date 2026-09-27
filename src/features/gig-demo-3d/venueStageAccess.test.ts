// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { disposeModel } from '@/features/player-model/model';
import {
  buildVenueProduction, productionLayout, stageAccessStairPlan,
} from './venueProduction';
import { resolveVenueProfile, VENUE_TYPES, type VenueKind } from './venueProfile';

const label = () => new T.Mesh(new T.PlaneGeometry(1, .3), new T.MeshBasicMaterial());

function build(type: VenueKind, capacity?: number) {
  const profile = resolveVenueProfile({ type, capacity });
  const scene = new T.Scene();
  const root = buildVenueProduction(
    scene, profile, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'THE SHOCKS',
  );
  return { profile, scene, root };
}

function checkPhysicalTiling(mesh: T.Mesh, main: T.MeshStandardMaterial, width: number, depth: number, stageWidth: number, stageDepth: number) {
  expect(mesh.material).toBe(main);
  const uv = mesh.geometry.attributes.uv;
  // Three.js BoxGeometry +Y top face is the four vertices beginning at 8.
  const range = (axis: 'x' | 'y') => {
    const values = [8, 9, 10, 11].map(i => axis === 'x' ? uv.getX(i) : uv.getY(i));
    return Math.max(...values) - Math.min(...values);
  };
  expect(range('x')).toBeCloseTo(width / stageWidth);
  expect(range('y')).toBeCloseTo(depth / stageDepth);
  expect(range('x') * (main.map?.repeat.x ?? 0)).toBeCloseTo(width / 2.4);
  expect(range('y') * (main.map?.repeat.y ?? 0)).toBeCloseTo(depth / 2.4);
  expect(mesh.userData.venueFloorPatch).toEqual({
    width, depth, repeatX: width / 2.4, repeatZ: depth / 2.4,
  });
}

describe('human-scale stage access at all venue types', () => {
  it.each(Object.keys(VENUE_TYPES) as VenueKind[])('%s reaches exactly the stage lip on both sides without reversing the step sequence', kind => {
    const { profile: p, scene, root } = build(kind);
    const plan = stageAccessStairPlan(p);
    expect(plan).toHaveLength(Math.ceil(p.stageHeight / .22));
    expect(plan[plan.length - 1].height).toBeCloseTo(p.stageHeight);
    expect(plan[plan.length - 1].z).toBeCloseTo(.65);
    const access = root.getObjectByName('stage-side-access-stairs') as T.Group;
    expect(access.userData).toMatchObject({
      stepsPerSide: plan.length, rise: p.stageHeight / plan.length, run: .38,
    });
    const main = root.getObjectByName('stage-main-deck-surface') as T.Mesh;
    const floor = main.material as T.MeshStandardMaterial;
    for (const side of [-1, 1]) {
      for (const step of plan) {
        const tread = root.getObjectByName('stage-access-tread-' + side + '-' + step.index) as T.Mesh;
        expect(tread).toBeDefined();
        expect(tread.position.x).toBeCloseTo(side * (p.stageWidth / 2 + .65));
        expect(tread.position.y + .015).toBeCloseTo(step.height + .003);
        expect(tread.position.z).toBeCloseTo(step.z);
        expect(step.height).toBeLessThanOrEqual(p.stageHeight + 1e-6);
        checkPhysicalTiling(tread, floor, 1.16, .34, p.stageWidth, p.stageDepth);
      }
      expect(plan[0].z).toBeGreaterThanOrEqual(plan[plan.length - 1].z);
    }
    expect(floor.map).not.toBeNull();
    expect(floor.bumpMap).not.toBeNull();
    disposeModel(scene);
  });
});

describe('capacity-correct material tiling on wing and runway decks', () => {
  it.each([
    ['live_house', 900],
    ['indoor_arena', 9000],
    ['stadium', 65000],
    ['festival_stage', 20000],
    ['festival_tent', 5000],
  ] as const)('%s reuses one pair of GPU textures for every human-scale stage deck', (kind, capacity) => {
    const { profile: p, scene, root } = build(kind, capacity);
    const main = root.getObjectByName('stage-main-deck-surface') as T.Mesh;
    const floor = main.material as T.MeshStandardMaterial;
    checkPhysicalTiling(main, floor, p.stageWidth, p.stageDepth, p.stageWidth, p.stageDepth);
    const winged = productionLayout(p).wings;
    for (const side of [-1, 1]) {
      const wing = root.getObjectByName('stage-side-wing-deck-surface-' + side) as T.Mesh | undefined;
      if (!winged) {
        expect(wing).toBeUndefined();
        continue;
      }
      expect(wing).toBeDefined();
      checkPhysicalTiling(wing!, floor, 3.8, p.stageDepth * .78, p.stageWidth, p.stageDepth);
      expect(wing!.position.x).toBeCloseTo(side * (p.stageWidth / 2 + 2));
    }
    const materialMaps = new Set<T.Texture>();
    root.traverse(node => {
      if (node instanceof T.Mesh && node.material === floor) {
        materialMaps.add(floor.map!);
        materialMaps.add(floor.bumpMap!);
      }
    });
    expect(materialMaps.size).toBe(2);
    disposeModel(scene);
  });

  it.each([
    ['indoor_arena', 18000],
    ['stadium', 65000],
    ['festival_stage', 20000],
  ] as const)('%s keeps the runway walkable with a separate tiled head and an open entry', (kind, capacity) => {
    const { profile: p, scene, root } = build(kind, capacity);
    expect(productionLayout(p).runway).toBe(true);
    const floor = (root.getObjectByName('stage-main-deck-surface') as T.Mesh).material as T.MeshStandardMaterial;
    const runway = root.getObjectByName('stage-runway') as T.Mesh;
    const landing = root.getObjectByName('stage-runway-head') as T.Mesh;
    const runwaySurface = root.getObjectByName('stage-runway-deck-surface') as T.Mesh;
    const landingSurface = root.getObjectByName('stage-runway-head-surface') as T.Mesh;
    const runwaySize = new T.Box3().setFromObject(runway).getSize(new T.Vector3());
    const headSize = new T.Box3().setFromObject(landing).getSize(new T.Vector3());
    expect(runwaySize.x).toBeCloseTo(3.2);
    expect(runwaySize.z).toBeCloseTo(6);
    expect(headSize.x).toBeCloseTo(6);
    expect(headSize.z).toBeCloseTo(2.8);
    expect(runway.position.z - runwaySize.z / 2).toBeCloseTo(.65);
    // Adjacent floor tops must touch exactly; overlapping coplanar stage
    // textures make the runway visibly flicker in motion.
    expect(runway.position.z + runwaySize.z / 2).toBeCloseTo(landing.position.z - headSize.z / 2);
    const runwayTop = new T.Box3().setFromObject(runwaySurface);
    const headTop = new T.Box3().setFromObject(landingSurface);
    expect(runwayTop.max.z).toBeCloseTo(headTop.min.z);
    expect(runwayTop.max.y).toBeCloseTo(headTop.max.y);
    checkPhysicalTiling(runwaySurface, floor, 3.2, 6, p.stageWidth, p.stageDepth);
    checkPhysicalTiling(landingSurface, floor, 6, 2.8, p.stageWidth, p.stageDepth);
    const left = root.getObjectByName('stage-front-edge--1') as T.Mesh;
    const right = root.getObjectByName('stage-front-edge-1') as T.Mesh;
    expect(root.getObjectByName('stage-front-edge')).toBeUndefined();
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    const width = (p.stageWidth - 3.2) / 2;
    expect(left.position.x + width / 2).toBeCloseTo(-1.6);
    expect(right.position.x - width / 2).toBeCloseTo(1.6);
    let lightTrimCount = 0;
    root.traverse(object => {
      if (object instanceof T.Mesh &&
          !Array.isArray(object.material) && object.material.name === 'stage-runway-edge-led') lightTrimCount++;
    });
    expect(lightTrimCount).toBeGreaterThan(0);
    disposeModel(scene);
  });

  it('does not place an unneeded runway in a smaller stadium or non-runway festival tent', () => {
    for (const [kind, capacity] of [['stadium', 9000], ['festival_tent', 20000]] as const) {
      const { profile, scene, root } = build(kind, capacity);
      expect(productionLayout(profile).runway).toBe(false);
      expect(root.getObjectByName('stage-runway')).toBeUndefined();
      expect(root.getObjectByName('stage-runway-head-surface')).toBeUndefined();
      expect(root.getObjectByName('stage-front-edge')).toBeDefined();
      disposeModel(scene);
    }
  });
});
