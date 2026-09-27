// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { disposeModel } from '@/features/player-model/model';
import { buildVenueProduction, productionLayout } from './venueProduction';
import {
  createVenueSpeakerGrille, lineArrayCabinetPose, productionEquipmentSpec,
} from './venueProductionQuality';
import { resolveVenueProfile, VENUE_TYPES, type VenueKind } from './venueProfile';

const label = () => new T.Mesh(new T.PlaneGeometry(1, .3), new T.MeshBasicMaterial());

describe('rights-clear physical speaker-front materials', () => {
  it.each(['line-array', 'subwoofer'] as const)('creates a small deterministic %s grille with visible drivers and fasteners', role => {
    const spec = productionEquipmentSpec(4);
    const a = createVenueSpeakerGrille(spec, role), b = createVenueSpeakerGrille(spec, role);
    const tex = a.map as T.DataTexture, second = b.map as T.DataTexture;
    const size = role === 'line-array' ? 512 : 256;
    expect(tex).toBeInstanceOf(T.DataTexture);
    expect(tex.image.width).toBe(size);
    expect(tex.image.height).toBe(256);
    expect(tex.image.data).toEqual(second.image.data);
    expect(tex.userData.venueSpeakerDetail).toEqual({
      role, width: size, height: 256, coneCount: role === 'line-array' ? 2 : 1,
    });
    const shades = new Set<number>();
    const bytes = tex.image.data as Uint8Array;
    for (let i = 0; i < bytes.length; i += 4) shades.add(bytes[i]);
    expect(shades.size).toBeGreaterThan(8);
    expect(Math.min(...shades)).toBeLessThan(25);
    expect(Math.max(...shades)).toBeGreaterThan(80);
    expect(tex.colorSpace).toBe(T.SRGBColorSpace);
    expect(tex.generateMipmaps).toBe(true);
    expect(tex.wrapS).toBe(T.ClampToEdgeWrapping);
    expect(a.userData.venueSpeakerRole).toBe(role);
    expect(a.map).not.toBe(b.map); // Independent scenes own their own upload/disposal.
    tex.dispose(); second.dispose(); a.dispose(); b.dispose();
  });

  it('grows true physical woofer spacing with the PA cabinet, not texture resolution', () => {
    const small = productionEquipmentSpec(1), large = productionEquipmentSpec(4);
    expect(large.paWidth).toBeGreaterThan(small.paWidth);
    expect(large.subWidth).toBeGreaterThan(small.subWidth);
    const smallMat = createVenueSpeakerGrille(small, 'line-array');
    const largeMat = createVenueSpeakerGrille(large, 'line-array');
    expect((smallMat.map as T.DataTexture).image.width).toBe((largeMat.map as T.DataTexture).image.width);
    expect((smallMat.map as T.DataTexture).image.data).not.toEqual((largeMat.map as T.DataTexture).image.data);
    smallMat.map?.dispose(); largeMat.map?.dispose(); smallMat.dispose(); largeMat.dispose();
  });
});

describe('downward-curved line-array geometry', () => {
  it.each([0, 1, 2, 3, 4])('production tier %i yields bounded, monotonically down-splayed PA and delay cabinets', tier => {
    const spec = productionEquipmentSpec(tier), count = [2, 2, 4, 8, 12][tier];
    let previous = -1, previousZ = -1;
    for (let index = 0; index < count; index++) {
      for (const gap of [.045, .025]) {
        const pose = lineArrayCabinetPose(index, spec, gap);
        expect(pose.tilt).toBeCloseTo(index * .018);
        expect(pose.tilt).toBeGreaterThanOrEqual(0);
        expect(pose.tilt).toBeLessThan(.22);
        expect(pose.forwardOffset).toBeGreaterThanOrEqual(0);
        expect(pose.forwardOffset).toBeLessThan(1);
        if (gap === .045) {
          expect(pose.tilt).toBeGreaterThan(previous);
          expect(pose.forwardOffset).toBeGreaterThanOrEqual(previousZ);
          previous = pose.tilt;
          previousZ = pose.forwardOffset;
        }
        if (index > 1) expect(pose.forwardOffset).toBeGreaterThan(0);
      }
    }
    expect(lineArrayCabinetPose(Number.NaN, spec)).toEqual({ tilt: 0, forwardOffset: 0 });
  });

  it.each([
    ['street_corner', 40], ['dive_bar', 150], ['concert_hall', 2500],
    ['indoor_arena', 9000], ['stadium', 65000],
  ] as const)('%s with %i fans builds true PA scale with one shared grille texture for the entire stage', (kind, capacity) => {
    const p = resolveVenueProfile({ type: kind, capacity }), scene = new T.Scene();
    const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'THE SHOCKS');
    const layout = productionLayout(p), spec = productionEquipmentSpec(layout.tier);
    const materials = new Map<string, Set<T.Material>>();
    const maps = new Map<string, Set<T.Texture>>();
    root.traverse(object => {
      if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
      const role = object.material.userData.venueSpeakerRole as string | undefined;
      if (!role) return;
      if (!materials.has(role)) materials.set(role, new Set());
      if (!maps.has(role)) maps.set(role, new Set());
      materials.get(role)!.add(object.material);
      maps.get(role)!.add((object.material as T.MeshStandardMaterial).map!);
    });
    if (!layout.arrayBoxes) {
      expect(materials.size).toBe(0);
      expect(root.getObjectByName('stage-pa-bumper-1')).toBeUndefined();
    } else {
      expect(materials.get('line-array')?.size).toBe(1);
      expect(maps.get('line-array')?.size).toBe(1);
      expect(materials.get('subwoofer')?.size).toBe(1);
      expect(maps.get('subwoofer')?.size).toBe(1);
      const first = root.getObjectByName('line-array-1-0') as T.Group;
      const last = root.getObjectByName('line-array-1-' + (layout.arrayBoxes - 1)) as T.Group;
      const firstPose = lineArrayCabinetPose(0, spec);
      const lastPose = lineArrayCabinetPose(layout.arrayBoxes - 1, spec);
      expect(first.position.z).toBeCloseTo(.45 + firstPose.forwardOffset);
      expect(first.rotation.x).toBeCloseTo(firstPose.tilt);
      expect(last.position.z).toBeCloseTo(.45 + lastPose.forwardOffset);
      expect(last.rotation.x).toBeCloseTo(lastPose.tilt);
      expect(last.position.y).toBeCloseTo(p.rigHeight - .55 - (layout.arrayBoxes - 1) * (spec.paHeight + .045));
      expect(root.getObjectByName('stage-pa-bumper-1')).toBeDefined();
      expect(root.getObjectByName('stage-pa-bumper--1')).toBeDefined();
      const facing = new T.Vector3(0, 0, 1).applyEuler(last.rotation);
      if (layout.arrayBoxes > 1) expect(facing.y).toBeLessThan(0);
      if (layout.wings) {
        const delay = root.getObjectByName('delay-array-1-' + p.crowdDepth * .43 + '-3') as T.Group;
        const delayPose = lineArrayCabinetPose(3, spec, .025);
        expect(delay).toBeDefined();
        expect(delay.position.z).toBeCloseTo(p.crowdDepth * .43 + delayPose.forwardOffset);
        expect(delay.rotation.x).toBeCloseTo(delayPose.tilt);
      }
    }
    disposeModel(scene);
  });

  it.each(Object.keys(VENUE_TYPES) as VenueKind[])('%s preserves finite, named flying arrays and PA units', kind => {
    const p = resolveVenueProfile({ type: kind });
    const scene = new T.Scene();
    const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'THE SHOCKS');
    const { arrayBoxes } = productionLayout(p);
    for (const side of [-1, 1]) {
      for (let i = 0; i < arrayBoxes; i++) {
        const array = root.getObjectByName('line-array-' + side + '-' + i) as T.Group;
        expect(array).toBeDefined();
        expect(array.position.toArray().every(Number.isFinite)).toBe(true);
        expect(array.rotation.x).toBeGreaterThanOrEqual(0);
      }
    }
    disposeModel(scene);
  });
});
