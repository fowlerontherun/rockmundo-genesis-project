import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  FACE_TOPOLOGY_SCHEMA,
  FACE_TOPOLOGY_VERSION,
  REQUIRED_FACE_LANDMARKS,
  verifyFaceTopologyProvenance,
} from '../verify-face-topology-provenance.mjs';

const temporary = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function validFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rmv2-face-proof-'));
  temporary.push(dir);
  const glb = path.join(dir, 'masculine-lod0.glb');
  fs.writeFileSync(glb, Buffer.from('synthetic exported mesh content'));
  const proof = {
    schema: FACE_TOPOLOGY_SCHEMA,
    version: FACE_TOPOLOGY_VERSION,
    file: path.basename(glb),
    frame: 'masculine',
    lod: 0,
    headMesh: 'RMV2_HeadSurface',
    passed: true,
    issues: [],
    landmarkVertices: Object.fromEntries(Object.entries(REQUIRED_FACE_LANDMARKS)),
    sha256: createHash('sha256').update(fs.readFileSync(glb)).digest('hex'),
  };
  const entry = { frame: 'masculine', lod: 0 };
  const gltf = { nodes: [{ name: 'RMV2_HeadSurface', mesh: 0, skin: 0 }] };
  const write = () => fs.writeFileSync(glb + '.face-topology.json', JSON.stringify(proof));
  write();
  return { glb, proof, entry, gltf, write };
}

test('accepted source sculpt proof is tied to exported head and GLB bytes', () => {
  const fixture = validFixture();
  assert.deepEqual(
    verifyFaceTopologyProvenance(fixture.glb, fixture.entry, fixture.gltf),
    fixture.proof,
  );
});

test('a changed GLB makes its older Blender sculpt proof invalid', () => {
  const fixture = validFixture();
  fs.appendFileSync(fixture.glb, ' altered');
  assert.throws(() => verifyFaceTopologyProvenance(fixture.glb, fixture.entry, fixture.gltf), /changed after Blender/);
});

test('close-up export without a matching sidecar is refused', () => {
  const fixture = validFixture();
  fs.rmSync(fixture.glb + '.face-topology.json');
  assert.throws(() => verifyFaceTopologyProvenance(fixture.glb, fixture.entry, fixture.gltf), /requires a Blender/);
});

test('a missing selected nostril rim cannot be claimed as authored', () => {
  const fixture = validFixture();
  fixture.proof.landmarkVertices['RMV2_NostrilRim.L'] = 0;
  fixture.write();
  assert.throws(() => verifyFaceTopologyProvenance(fixture.glb, fixture.entry, fixture.gltf), /RMV2_NostrilRim.L/);
});

test('the provenance must refer to an actual exported skinned head', () => {
  const fixture = validFixture();
  fixture.gltf.nodes[0].skin = undefined;
  assert.throws(() => verifyFaceTopologyProvenance(fixture.glb, fixture.entry, fixture.gltf), /not a skinned mesh/);
});

test('different frame and LOD proof cannot be reused', () => {
  const fixture = validFixture();
  assert.throws(
    () => verifyFaceTopologyProvenance(fixture.glb, { frame: 'feminine', lod: 0 }, fixture.gltf),
    /does not match/,
  );
  fixture.proof.lod = 1;
  fixture.write();
  assert.throws(
    () => verifyFaceTopologyProvenance(fixture.glb, fixture.entry, fixture.gltf),
    /does not match/,
  );
});

test('an audit with outstanding sculpt issues does not pass', () => {
  const fixture = validFixture();
  fixture.proof.issues.push('ear landmark wrong side');
  fixture.write();
  assert.throws(() => verifyFaceTopologyProvenance(fixture.glb, fixture.entry, fixture.gltf), /did not pass/);
});

test('low-detail LOD2 and LOD3 intentionally skip close-up proof', () => {
  const fixture = validFixture();
  fs.rmSync(fixture.glb + '.face-topology.json');
  assert.equal(verifyFaceTopologyProvenance(fixture.glb, { ...fixture.entry, lod: 2 }, fixture.gltf), null);
  assert.equal(verifyFaceTopologyProvenance(fixture.glb, { ...fixture.entry, lod: 3 }, fixture.gltf), null);
});
