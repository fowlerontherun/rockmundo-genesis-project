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

  it('uses a clearer physical lens response at ultra quality', () => {
    const ultra = buildHeadAccessory({ slot: 'eyewear', style: 'aviator', color: '#222222', lenses: 'clear', lensColor: '#8aaacc' }, bounds, 'ultra');
    const lens = ultra.getObjectByName('glasses-lens-1') as T.Mesh<T.BufferGeometry, T.MeshPhysicalMaterial>;
    expect(lens.material.clearcoat).toBe(1);
    expect(lens.material.roughness).toBeLessThan(.05);
    expect(lens.material.envMapIntensity).toBeGreaterThan(1.5);
  });
});
