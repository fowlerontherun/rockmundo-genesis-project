import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildHeadAccessory } from './accessoryGeometry';

const bounds = new T.Box3(new T.Vector3(-.16, 1.4, -.14), new T.Vector3(.16, 1.78, .16));

describe('head accessory quality', () => {
  it('uses denser glasses geometry at ultra quality', () => {
    const balanced = buildHeadAccessory({ slot: 'eyewear', style: 'round', color: '#222222', lenses: 'clear' }, bounds, 'balanced');
    const ultra = buildHeadAccessory({ slot: 'eyewear', style: 'round', color: '#222222', lenses: 'clear' }, bounds, 'ultra');
    const balancedFrame = balanced.getObjectByName('glasses-frame-1') as T.Mesh;
    const ultraFrame = ultra.getObjectByName('glasses-frame-1') as T.Mesh;
    expect(ultraFrame.geometry.getAttribute('position').count).toBeGreaterThan(balancedFrame.geometry.getAttribute('position').count);
  });

  it('fits glasses to supplied eye and ear anchors instead of generic head offsets', () => {
    const fit = {
      leftEye: new T.Vector3(-.075, 1.61, .165),
      rightEye: new T.Vector3(.083, 1.605, .168),
      leftEar: new T.Vector3(-.165, 1.575, .02),
      rightEar: new T.Vector3(.168, 1.57, .018),
    };
    const glasses = buildHeadAccessory(
      { slot: 'eyewear', style: 'round', color: '#222222', lenses: 'clear' },
      bounds,
      'high',
      fit,
    );
    const leftLens = glasses.getObjectByName('glasses-lens--1') as T.Mesh;
    const rightLens = glasses.getObjectByName('glasses-lens-1') as T.Mesh;
    const leftHook = glasses.getObjectByName('glasses-ear-hook--1') as T.Mesh;
    const rightHook = glasses.getObjectByName('glasses-ear-hook-1') as T.Mesh;
    expect(leftLens.position.x).toBeCloseTo(fit.leftEye.x, 4);
    expect(rightLens.position.x).toBeCloseTo(fit.rightEye.x, 4);
    expect(leftHook.position.z).toBeCloseTo(fit.leftEar.z, 4);
    expect(rightHook.position.z).toBeCloseTo(fit.rightEar.z, 4);
  });


  it('builds real curved temples that join the lens rims to V2 +X-left ear anchors', () => {
    // The V2 rig uses +X for Eye.L / EarAnchor.L, unlike legacy avatar
    // surface fitting. Saved semantic sides must follow bones, not X signs.
    const fit = {
      leftEye: new T.Vector3(.075, 1.61, .165),
      rightEye: new T.Vector3(-.083, 1.605, .168),
      leftEar: new T.Vector3(.165, 1.575, .02),
      rightEar: new T.Vector3(-.168, 1.57, .018),
    };
    const glasses = buildHeadAccessory(
      { slot: 'eyewear', style: 'rectangle', color: '#222222', lenses: 'clear' },
      bounds,
      'ultra',
      fit,
    );
    for (const [side, eye, ear, outward] of [
      [-1, fit.leftEye, fit.leftEar, 1],
      [1, fit.rightEye, fit.rightEar, -1],
    ] as const) {
      const arm = glasses.getObjectByName(`glasses-arm-${side}`) as T.Mesh<T.TubeGeometry>;
      const lens = glasses.getObjectByName(`glasses-lens-${side}`) as T.Mesh;
      const hook = glasses.getObjectByName(`glasses-ear-hook-${side}`) as T.Mesh<T.TubeGeometry>;
      const geometryPath = arm.geometry.parameters.path as T.CatmullRomCurve3;
      const hinge = geometryPath.getPoint(0);
      const armEnd = geometryPath.getPoint(1);
      const lensWidth = T.MathUtils.clamp(
        Math.abs(fit.rightEye.x - fit.leftEye.x) * .40,
        .32 * .16,
        .32 * .21,
      );
      expect(lens.position.x).toBeCloseTo(eye.x, 5);
      expect(hinge.x).toBeCloseTo(eye.x + outward * lensWidth * .98, 5);
      expect(hinge.z).toBeGreaterThan(eye.z);
      expect(armEnd.distanceTo(ear.clone().add(new T.Vector3(0, .38 * .035, 0)))).toBeLessThan(1e-6);
      expect(hook.position.distanceTo(armEnd)).toBeLessThan(1e-6);
      expect(arm.userData.rockmundoTempleFit.outward).toBe(outward);
      expect(hook.userData.rockmundoEarAnchor).toEqual(ear.toArray());
    }
  });

  it('keeps V1 -X-left glasses arms fitted to the same semantic sides', () => {
    const fit = {
      leftEye: new T.Vector3(-.075, 1.61, .165),
      rightEye: new T.Vector3(.075, 1.61, .165),
      leftEar: new T.Vector3(-.17, 1.575, .015),
      rightEar: new T.Vector3(.17, 1.575, .015),
    };
    const glasses = buildHeadAccessory(
      { slot: 'eyewear', style: 'round', color: '#222222' },
      bounds,
      'high',
      fit,
    );
    const left = glasses.getObjectByName('glasses-arm--1') as T.Mesh<T.TubeGeometry>;
    const right = glasses.getObjectByName('glasses-arm-1') as T.Mesh<T.TubeGeometry>;
    expect(left.userData.rockmundoTempleFit.outward).toBe(-1);
    expect(right.userData.rockmundoTempleFit.outward).toBe(1);
    expect((left.geometry.parameters.path as T.CatmullRomCurve3).getPoint(1).x).toBeCloseTo(fit.leftEar.x);
    expect((right.geometry.parameters.path as T.CatmullRomCurve3).getPoint(1).x).toBeCloseTo(fit.rightEar.x);
  });

  it('uses a clearer physical lens response at ultra quality', () => {
    const ultra = buildHeadAccessory({ slot: 'eyewear', style: 'aviator', color: '#222222', lenses: 'clear', lensColor: '#8aaacc' }, bounds, 'ultra');
    const lens = ultra.getObjectByName('glasses-lens-1') as T.Mesh<T.BufferGeometry, T.MeshPhysicalMaterial>;
    expect(lens.material.clearcoat).toBe(1);
    expect(lens.material.roughness).toBeLessThan(.05);
    expect(lens.material.envMapIntensity).toBeGreaterThan(1.5);
  });
});
