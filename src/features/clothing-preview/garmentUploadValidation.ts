import * as T from 'three';

/** Rules every uploaded garment GLB must pass before it can go live. See docs/curated-garment-authoring-rules.md. */
export const GARMENT_UPLOAD_RULES = {
  maxFileBytes: 20 * 1024 * 1024,
  maxMaterials: 4,
  triangleBudget: { headwear: 4000, eyewear: 3000, top: 16000, outerwear: 20000, bottom: 14000, footwear: 8000, default: 16000 } as Record<string, number>,
  forbiddenMeshNames: /(^|_|\b)(head|skin|body_?base|eye|eyebrow|hair)(\b|_|$)/i,
};

export interface GarmentValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  triangles: number;
  materials: number;
  skinnedMeshes: number;
}

export function validateGarmentScene(scene: T.Object3D, referenceBones: Set<string>, slot: string): GarmentValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let triangles = 0, skinnedMeshes = 0;
  const materials = new Set<string>();
  const unknownBones = new Set<string>();
  scene.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry as T.BufferGeometry;
    triangles += (geometry.index ? geometry.index.count : geometry.getAttribute('position')?.count ?? 0) / 3;
    for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m.name || m.uuid);
    if (GARMENT_UPLOAD_RULES.forbiddenMeshNames.test(node.name)) errors.push(`Mesh "${node.name}" looks like a body part. Garment files must not contain the avatar body.`);
    if (node instanceof T.SkinnedMesh) {
      skinnedMeshes += 1;
      node.skeleton.bones.forEach(b => { if (!referenceBones.has(b.name)) unknownBones.add(b.name); });
    } else {
      errors.push(`Mesh "${node.name || 'unnamed'}" is not skinned to the avatar skeleton.`);
    }
  });
  if (!skinnedMeshes) errors.push('No skinned meshes found.');
  if (unknownBones.size) errors.push(`Unknown bones: ${[...unknownBones].slice(0, 6).join(', ')}${unknownBones.size > 6 ? '…' : ''}. Use the Rockmundo skeleton bone names exactly.`);
  const budget = GARMENT_UPLOAD_RULES.triangleBudget[slot] ?? GARMENT_UPLOAD_RULES.triangleBudget.default;
  if (triangles > budget) errors.push(`${Math.round(triangles)} triangles is over the ${budget} budget for ${slot}.`);
  else if (triangles > budget * .85) warnings.push(`Close to the triangle budget (${Math.round(triangles)}/${budget}).`);
  if (materials.size > GARMENT_UPLOAD_RULES.maxMaterials) errors.push(`${materials.size} materials — maximum is ${GARMENT_UPLOAD_RULES.maxMaterials}.`);
  return { ok: errors.length === 0, errors, warnings, triangles: Math.round(triangles), materials: materials.size, skinnedMeshes };
}
