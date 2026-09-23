import * as T from 'three';

export interface SurfaceAttachment {
  point: T.Vector3;
  normal: T.Vector3;
  distance: number;
  mesh: T.SkinnedMesh;
}

function belongsToPart(node: T.Object3D, part: 'body' | 'legs' | 'feet') {
  let current: T.Object3D | null = node;
  const pattern = new RegExp(`_${part}(?:_|$)`, 'i');
  while (current) {
    if (pattern.test(current.name)) return true;
    current = current.parent;
  }
  return false;
}

/**
 * Finds the actual visible front surface of a fitted avatar part. Decorative
 * graphics use this instead of guessed world offsets, so logos/prints sit on
 * the garment surface for both avatar frames.
 */
export function findFrontSurfaceAttachment(
  root: T.Object3D,
  part: 'body' | 'legs' | 'feet',
  around: T.Vector3,
  yOffset = 0,
): SurfaceAttachment | null {
  root.updateMatrixWorld(true);

  const meshes: T.SkinnedMesh[] = [];
  root.traverse(node => {
    if (node instanceof T.SkinnedMesh && node.visible && belongsToPart(node, part)) meshes.push(node);
  });
  if (!meshes.length) return null;

  const worldBounds = new T.Box3();
  for (const mesh of meshes) {
    const bounds = new T.Box3().setFromObject(mesh);
    if (!bounds.isEmpty()) worldBounds.union(bounds);
  }
  if (worldBounds.isEmpty()) return null;

  const depth = Math.max(.5, worldBounds.max.z - worldBounds.min.z + .5);
  const origin = new T.Vector3(
    around.x,
    around.y + yOffset,
    worldBounds.max.z + depth,
  );
  const raycaster = new T.Raycaster(origin, new T.Vector3(0, 0, -1), 0, depth * 3);
  const hits = raycaster.intersectObjects(meshes, false);
  const hit = hits.find(candidate => candidate.face && candidate.object instanceof T.SkinnedMesh);
  if (!hit?.face || !(hit.object instanceof T.SkinnedMesh)) return null;

  const normal = hit.face.normal.clone();
  const normalMatrix = new T.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  normal.applyMatrix3(normalMatrix).normalize();
  if (normal.z < 0) normal.multiplyScalar(-1);

  return {
    point: hit.point.clone(),
    normal,
    distance: hit.distance,
    mesh: hit.object,
  };
}

export function attachSurfaceGraphic(
  root: T.Object3D,
  bone: T.Bone,
  object: T.Object3D,
  attachment: SurfaceAttachment,
  surfaceOffset = .0025,
) {
  object.position.copy(attachment.point).addScaledVector(attachment.normal, surfaceOffset);
  object.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), attachment.normal);
  root.add(object);
  root.updateMatrixWorld(true);
  bone.attach(object);
  object.userData.surfaceBound = true;
  object.userData.surfaceOffset = surfaceOffset;
  object.userData.surfaceMesh = attachment.mesh.name;
  return object;
}

/**
 * A few horizontal segments let a chest print follow the torso better than a
 * perfectly flat billboard while remaining cheap enough for gigs and crowds.
 */
export function curvedGraphicGeometry(width: number, height: number, curve = .012) {
  const geometry = new T.PlaneGeometry(width, height, 8, 2);
  const position = geometry.attributes.position;
  const half = width / 2 || 1;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const normalized = Math.min(1, Math.abs(x / half));
    position.setZ(i, -curve * normalized * normalized);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}
