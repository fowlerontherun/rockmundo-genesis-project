import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { attachSurfaceGraphic, curvedGraphicGeometry, findFrontSurfaceAttachment } from './curatedSurfaceAttachment';

function fittedBody() {
  const root = new T.Group();
  const bone = new T.Bone();
  bone.name = 'Chest';
  root.add(bone);

  const geometry = new T.BoxGeometry(.6, .7, .22, 4, 4, 2);
  const count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));

  const mesh = new T.SkinnedMesh(geometry, new T.MeshStandardMaterial());
  mesh.name = 'Casual_body_mesh';
  const skeleton = new T.Skeleton([bone]);
  mesh.bind(skeleton);
  root.add(mesh);
  root.updateMatrixWorld(true);
  return { root, bone, mesh };
}

describe('curated surface attachments', () => {
  it('resolves the actual front surface instead of using a guessed z offset', () => {
    const { root } = fittedBody();
    const hit = findFrontSurfaceAttachment(root, 'body', new T.Vector3(0, 0, 0));
    expect(hit).toBeTruthy();
    expect(hit!.point.z).toBeGreaterThan(.09);
    expect(hit!.normal.z).toBeGreaterThan(.5);
  });

  it('marks attached graphics as surface bound with a tiny controlled offset', () => {
    const { root, bone, mesh } = fittedBody();
    const attachment = {
      point: new T.Vector3(0, 0, .11),
      normal: new T.Vector3(0, 0, 1),
      distance: 1,
      mesh,
    };
    const graphic = new T.Mesh(curvedGraphicGeometry(.3, .07), new T.MeshBasicMaterial());
    attachSurfaceGraphic(root, bone, graphic, attachment, .0015);
    expect(graphic.userData.surfaceBound).toBe(true);
    expect(graphic.userData.surfaceOffset).toBe(.0015);
    expect(graphic.position.z).toBeGreaterThan(0);
  });

  it('curves chest graphics slightly rather than leaving them as flat billboards', () => {
    const geometry = curvedGraphicGeometry(.3, .07, .01);
    const position = geometry.attributes.position;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < position.count; i++) {
      minZ = Math.min(minZ, position.getZ(i));
      maxZ = Math.max(maxZ, position.getZ(i));
    }
    expect(minZ).toBeLessThan(maxZ);
    expect(Math.abs(minZ)).toBeLessThan(.02);
  });
});
