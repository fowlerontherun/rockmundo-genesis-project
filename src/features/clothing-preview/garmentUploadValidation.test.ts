import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { validateGarmentScene } from './garmentUploadValidation';

function skinned(name: string, boneNames: string[], tris = 10) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(new Array(tris * 9).fill(0), 3));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Array(tris * 12).fill(0), 4));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(Array.from({ length: tris * 12 }, (_, i) => i % 4 === 0 ? 1 : 0), 4));
  const mesh = new T.SkinnedMesh(g, new T.MeshStandardMaterial({ name: 'mat_cloth' }));
  mesh.name = name;
  const bones = boneNames.map(n => Object.assign(new T.Bone(), { name: n }));
  mesh.bind(new T.Skeleton(bones));
  const root = new T.Group(); root.add(mesh); return root;
}
const ref = new Set(['Hips', 'Spine', 'Chest']);

describe('garment upload validation', () => {
  it('accepts a skinned garment on known bones', () => {
    expect(validateGarmentScene(skinned('Tee', ['Hips', 'Spine']), ref, 'top').ok).toBe(true);
  });
  it('rejects unknown bones', () => {
    expect(validateGarmentScene(skinned('Tee', ['Hips', 'DonorSpine']), ref, 'top').ok).toBe(false);
  });
  it('rejects body meshes inside the garment', () => {
    expect(validateGarmentScene(skinned('Casual_Head', ['Hips']), ref, 'top').ok).toBe(false);
  });
  it('rejects a top over 16000 triangles', () => {
    expect(validateGarmentScene(skinned('Tee', ['Hips'], 16001), ref, 'top').ok).toBe(false);
  });
  it('rejects unskinned meshes', () => {
    const root = new T.Group(); root.add(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()));
    expect(validateGarmentScene(root, ref, 'top').ok).toBe(false);
  });
  it('rejects missing skin weights that would detach on stage', () => {
    const root = skinned('Tee', ['Hips']);
    const mesh = root.children[0] as T.SkinnedMesh;
    mesh.geometry.deleteAttribute('skinWeight');
    expect(validateGarmentScene(root, ref, 'top').ok).toBe(false);
  });
  it('rejects unnormalised animation weights', () => {
    const root = skinned('Tee', ['Hips']);
    const mesh = root.children[0] as T.SkinnedMesh;
    mesh.geometry.getAttribute('skinWeight').setX(0, .2);
    expect(validateGarmentScene(root, ref, 'top').ok).toBe(false);
  });
  it('rejects invalid garment coordinates', () => {
    const root = skinned('Tee', ['Hips']);
    const mesh = root.children[0] as T.SkinnedMesh;
    mesh.geometry.getAttribute('position').setX(0, NaN);
    expect(validateGarmentScene(root, ref, 'top').ok).toBe(false);
  });
  it('counts distinct materials even when names match', () => {
    const root = skinned('Tee', ['Hips']);
    const mesh = root.children[0] as T.SkinnedMesh;
    mesh.material = Array.from({ length: 5 }, () => new T.MeshStandardMaterial({ name: 'cloth' }));
    expect(validateGarmentScene(root, ref, 'top').ok).toBe(false);
  });
});
