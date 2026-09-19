import * as T from 'three';

/** The shipped low-poly heads have no jaw or facial morphs. Add a small mouth
 * on the actual face surface, attached to the head so it follows the rig. */
export function createVocalMouth(root: T.Group, model: T.Object3D, head: T.Bone) {
  root.updateMatrixWorld(true);
  const anchor = root.worldToLocal(head.getWorldPosition(new T.Vector3()));
  const height = anchor.y + .032;
  let front = -Infinity;
  const point = new T.Vector3();
  model.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!materials.some(material => /skin/i.test(material.name))) return;
    if (object instanceof T.SkinnedMesh) object.skeleton.update();
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i);
      if (object instanceof T.SkinnedMesh) object.applyBoneTransform(i, point);
      root.worldToLocal(point.applyMatrix4(object.matrixWorld));
      if (Math.abs(point.x - anchor.x) < .03 && Math.abs(point.y - height) < .023)
        front = Math.max(front, point.z);
    }
  });
  const mouth = new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshStandardMaterial({ color: '#351821', roughness: .92 }));
  mouth.name = 'singing-mouth';
  mouth.position.set(anchor.x, height, (Number.isFinite(front) ? front : anchor.z + .10) + .004);
  mouth.scale.set(.023, .008, .006);
  root.add(mouth);
  root.updateMatrixWorld(true);
  head.attach(mouth);
  mouth.userData.restScale = mouth.scale.clone();
  return mouth;
}
