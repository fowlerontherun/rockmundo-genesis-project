import * as T from 'three';

export const isDress = (id: string) => id === 'starter.top.sundress' || id === 'starter.top.skater-dress';
export const isVest = (id: string) => id === 'starter.top.vest' || id === 'starter.top.striped-vest';
export const isSkirt = (id: string) => id === 'starter.bottom.mini-skirt' || id === 'starter.bottom.pleated-skirt';

/** A continuous open hem, with no trouser crotch. Bind to the pelvis and blend
 * toward both thighs so the cloth follows the performance rig without splitting. */
export function addFittedSkirt(root: T.Object3D, bones: Map<string, T.Bone>, id: string, colour: string) {
  root.updateMatrixWorld(true);
  const find = (pattern: RegExp) => [...bones.values()].find(bone => pattern.test(bone.name.replace(/[_.]/g, '')));
  const pelvis = find(/^(hips|pelvis)$/i);
  const left = find(/^(leftupleg|upperlegl)$/i), right = find(/^(rightupleg|upperlegr)$/i);
  if (!pelvis || !left || !right) return;
  const hip = pelvis.getWorldPosition(new T.Vector3());
  const lp = left.getWorldPosition(new T.Vector3()), rp = right.getWorldPosition(new T.Vector3());
  const spread = Math.abs(lp.x - rp.x);
  const mini = id.includes('mini');
  const pleats = id.includes('pleated') || id.includes('skater');
  const dress = isDress(id);
  const waistY = Math.max(lp.y, rp.y) + .105;
  const length = mini ? .27 : dress ? (pleats ? .43 : .49) : .38;
  const radiusX = Math.max(.14, spread * .85);
  const radiusZ = .17;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [], skinIndices: number[] = [], weights: number[] = [];
  const segments = 64, rows = 12;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const flare = T.MathUtils.smoothstep(t, 0, 1);
    for (let col = 0; col <= segments; col++) {
      const angle = col / segments * Math.PI * 2;
      const fold = pleats ? Math.cos(angle * 16) * .012 * flare : 0;
      const x = Math.cos(angle) * (radiusX + (mini ? .085 : .17) * flare + fold);
      const z = Math.sin(angle) * (radiusZ + (mini ? .065 : .14) * flare + fold);
      positions.push(hip.x + x, waistY - t * length, hip.z + z);
      uvs.push(col / segments, t);
      const follow = .7 * t * t;
      const leftMix = T.MathUtils.smoothstep(x, -.08, .08);
      const leftOnPositiveX = lp.x > rp.x;
      const sideWeight = leftOnPositiveX ? leftMix : 1 - leftMix;
      skinIndices.push(0, 1, 2, 0);
      weights.push(1 - follow, follow * sideWeight, follow * (1 - sideWeight), 0);
      if (row < rows && col < segments) {
        const a = row * (segments + 1) + col, b = a + segments + 1;
        indices.push(a,a+1,b, a+1,b+1,b);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const material = new T.MeshStandardMaterial({ color: colour, roughness: .88, side: T.DoubleSide });
  material.name = 'SkirtFabric';
  const skirt = new T.SkinnedMesh(geometry, material);
  skirt.name = 'avatar-v1-fitted-skirt'; skirt.userData.garmentId = id;
  skirt.castShadow = true; skirt.receiveShadow = true;
  root.add(skirt);
  const drivers = [pelvis, left, right];
  skirt.bind(new T.Skeleton(drivers, drivers.map(bone => bone.matrixWorld.clone().invert())), new T.Matrix4());
  return skirt;
}
