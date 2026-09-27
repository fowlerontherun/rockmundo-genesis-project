import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { applyAvatarV2PreviewProportions } from './avatarV2PreviewProportions';

function model() {
  const root = new T.Group();
  const mesh = new T.Mesh(new T.BoxGeometry(1, 2, .5));
  mesh.position.set(0, 2, 0); // source bottom is 1m above its origin
  root.add(mesh);
  return root;
}

function bottom(root: T.Object3D) {
  return new T.Box3().setFromObject(root).min.y;
}

describe('Avatar V2 reference-only proportion transforms', () => {
  it('grounds a source with a non-zero origin on initial load', () => {
    const root = model();
    applyAvatarV2PreviewProportions(root, .89, { height: 1.1, build: 1.15 });
    expect(bottom(root)).toBeCloseTo(0, 7);
    expect(root.scale.toArray()).toEqual([.89 * 1.15, .89 * 1.1, .89 * 1.15]);
  });

  it('does not compound repeated slider edits and returns to baseline on reset', () => {
    const root = model();
    applyAvatarV2PreviewProportions(root, .89, { height: 1, build: 1 });
    const initialPosition = root.position.y;
    for (let i = 0; i < 15; i++) {
      applyAvatarV2PreviewProportions(root, .89, { height: .9, build: .85 });
      expect(bottom(root)).toBeCloseTo(0, 7);
      applyAvatarV2PreviewProportions(root, .89, { height: 1.1, build: 1.15 });
      expect(bottom(root)).toBeCloseTo(0, 7);
    }
    applyAvatarV2PreviewProportions(root, .89, { height: 1, build: 1 });
    expect(bottom(root)).toBeCloseTo(0, 7);
    expect(root.position.y).toBeCloseTo(initialPosition, 7);
    expect(root.scale.toArray()).toEqual([.89, .89, .89]);
  });

  it('rejects an empty source rather than applying an infinite offset', () => {
    expect(() => applyAvatarV2PreviewProportions(new T.Group(), 1, { height: 1, build: 1 }))
      .toThrow('Cannot ground an empty V2 reference model.');
  });
});
