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

  it('uses a clearer physical lens response at ultra quality', () => {
    const ultra = buildHeadAccessory({ slot: 'eyewear', style: 'aviator', color: '#222222', lenses: 'clear', lensColor: '#8aaacc' }, bounds, 'ultra');
    const lens = ultra.getObjectByName('glasses-lens-1') as T.Mesh<T.BufferGeometry, T.MeshPhysicalMaterial>;
    expect(lens.material.clearcoat).toBe(1);
    expect(lens.material.roughness).toBeLessThan(.05);
    expect(lens.material.envMapIntensity).toBeGreaterThan(1.5);
  });
});
