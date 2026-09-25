/**
 * Enforces the link between a close-up GLB and its Blender sculpt audit.
 * Blender vertex groups are authoring data and are not preserved by standard
 * glTF. The sidecar binds the source audit result to the EXACT exported GLB
 * with a SHA-256 fingerprint. This is integrity and provenance verification,
 * not independent certification of the artistic quality of the sculpt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const FACE_TOPOLOGY_SCHEMA = 'rockmundo.avatar-v2-face-topology';
export const FACE_TOPOLOGY_VERSION = 1;

export const REQUIRED_FACE_LANDMARKS = Object.freeze({
  RMV2_NoseBridge: 8,
  RMV2_NoseTip: 8,
  'RMV2_NostrilRim.L': 8,
  'RMV2_NostrilRim.R': 8,
  'RMV2_EarHelix.L': 14,
  'RMV2_EarHelix.R': 14,
  'RMV2_EarAntihelix.L': 10,
  'RMV2_EarAntihelix.R': 10,
  'RMV2_EarLobe.L': 8,
  'RMV2_EarLobe.R': 8,
});

/**
 * Throws rather than silently weakening validation of a present close-up GLB.
 */
export function verifyFaceTopologyProvenance(glbPath, entry, gltf) {
  if (entry.lod > 1) return null;
  const sidecarPath = glbPath + '.face-topology.json';
  let proof;
  try {
    proof = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  } catch (error) {
    throw new Error(
      'LOD' + entry.lod + ' requires a Blender face-topology audit alongside its GLB: '
      + path.basename(sidecarPath) + ' (' + String(error) + ')',
    );
  }
  if (proof?.schema !== FACE_TOPOLOGY_SCHEMA || proof?.version !== FACE_TOPOLOGY_VERSION) {
    throw new Error('Face-topology audit has an unsupported schema/version. Re-export with the Blender V2 exporter.');
  }
  if (proof.file !== path.basename(glbPath) || proof.frame !== entry.frame || proof.lod !== entry.lod) {
    throw new Error('Face-topology audit does not match the exported GLB frame/LOD/filename.');
  }
  if (!proof.passed || !Array.isArray(proof.issues) || proof.issues.length !== 0) {
    throw new Error('Face-topology audit did not pass on the authoring source.');
  }
  if (!proof.headMesh || typeof proof.headMesh !== 'string') {
    throw new Error('Face-topology audit is missing its authoring head-mesh identity.');
  }
  const headNodes = (gltf.nodes ?? []).filter(node => node.name === proof.headMesh);
  if (!headNodes.some(node => node.mesh !== undefined && node.skin !== undefined)) {
    throw new Error('Face-topology head ' + proof.headMesh + ' is not a skinned mesh in this GLB.');
  }
  for (const [name, minimum] of Object.entries(REQUIRED_FACE_LANDMARKS)) {
    const count = proof.landmarkVertices?.[name];
    if (!Number.isInteger(count) || count < minimum) {
      throw new Error('Face-topology source landmark ' + name + ' needs at least ' + minimum + ' vertices.');
    }
  }
  if (typeof proof.sha256 !== 'string' || !/^[\da-f]{64}$/.test(proof.sha256)) {
    throw new Error('Face-topology audit has no valid GLB SHA-256 fingerprint.');
  }
  const actualHash = createHash('sha256').update(fs.readFileSync(glbPath)).digest('hex');
  if (actualHash !== proof.sha256) {
    throw new Error('GLB changed after Blender facial-topology audit: re-export both GLB and sidecar.');
  }
  return proof;
}
