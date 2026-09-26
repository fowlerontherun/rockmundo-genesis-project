import { describe, expect, it } from 'vitest';
import {
  avatarV2ReferenceImageUrl,
  avatarV2ReferenceModelUrl,
  parseAvatarV2ReferenceManifest,
} from './avatarV2ReferencePreview';

const frames = ['masculine', 'feminine'] as const;
const views = ['front', 'quarter', 'side', 'face'] as const;

function validManifest() {
  const files: Array<{ file: string; bytes: number; sha256: string }> = [];
  const frameData = frames.map(frame => {
    const entry = {
      frame,
      source: `${frame}/${frame}-SOURCE-ONLY-not-validated.glb`,
      lookdev: `${frame}/${frame}-LOOKDEV-ONLY-not-validated.glb`,
      sourceViews: Object.fromEntries(views.map(view => [view, `${frame}/${frame}-${view}.png`])),
      lookdevViews: Object.fromEntries(views.map(view => [view, `${frame}/${frame}-lookdev-${view}.png`])),
    };
    const entries = [entry.source, entry.lookdev, ...Object.values(entry.sourceViews), ...Object.values(entry.lookdevViews)];
    entries.forEach(file => files.push({ file, bytes: 4096, sha256: 'a'.repeat(64) }));
    return entry;
  });
  return {
    schema: 'rockmundo.avatar-v2-reference-previews',
    version: 1,
    source: 'blender-human-base-meshes-v1.4.1',
    previewOnly: true,
    productionValidated: false,
    frames: frameData,
    files,
  };
}

function manifestWithMeasuredAnatomy() {
  const base = validManifest();
  return {
    ...base,
    frames: base.frames.map(frame => ({
      ...frame,
      sourceJointSuggestions: {
        schema: 'rockmundo.avatar-v2-source-joint-suggestions',
        version: 1,
        frame: frame.frame,
        source: 'actual CC0 eyeball and continuous body vertices',
        eyeRadiiMm: { L: 36, R: 36 },
        artistReviewed: false,
        rigFitted: false,
        skinWeightsAuthored: false,
        suggestions: (['Eye.L', 'Eye.R', 'EarAnchor.L', 'EarAnchor.R'] as const).map(bone => ({
          bone,
          position: [bone.endsWith('.L') ? .05 : -.05, -.03, bone.startsWith('Eye') ? 1.56 : 1.50],
          armatureLocal: [bone.endsWith('.L') ? .05 : -.05, -.03, bone.startsWith('Eye') ? 1.56 : 1.50],
          sourceMesh: 'original actual CC0 geometry',
          sourceSamples: bone.startsWith('Eye') ? 350 : 18,
          realSourceGeometry: true,
          artistReviewed: false,
        })),
      },
    })),
  };
}

describe('Avatar V2 real-source gallery boundary', () => {
  it('accepts a complete source-verified, explicitly preview-only pair', () => {
    expect(parseAvatarV2ReferenceManifest(validManifest())).not.toBeNull();
  });
  it('refuses missing frame, forged production readiness, and missing proof images', () => {
    const missing = validManifest(); missing.frames.pop();
    expect(parseAvatarV2ReferenceManifest(missing)).toBeNull();
    expect(parseAvatarV2ReferenceManifest({ ...validManifest(), productionValidated: true })).toBeNull();
    const missingProof = validManifest(); missingProof.files.pop();
    expect(parseAvatarV2ReferenceManifest(missingProof)).toBeNull();
  });
  it('refuses remote URL injection in the manifest', () => {
    const forged = validManifest();
    forged.frames[0].lookdev = 'https://example.com/other.glb';
    expect(parseAvatarV2ReferenceManifest(forged)).toBeNull();
  });
  it('accepts measured eyes and ears while retaining a non-production guide flag', () => {
    const parsed = parseAvatarV2ReferenceManifest(manifestWithMeasuredAnatomy());
    expect(parsed?.frames[0].sourceJointSuggestions?.suggestions.map(s => s.bone))
      .toEqual(['Eye.L', 'Eye.R', 'EarAnchor.L', 'EarAnchor.R']);
    expect(parsed?.frames[0].sourceJointSuggestions?.rigFitted).toBe(false);
  });
  it('fails closed on claimed fitted rig, fake anatomical coordinate and missing bone', () => {
    const approved = manifestWithMeasuredAnatomy();
    approved.frames[0].sourceJointSuggestions.rigFitted = true;
    expect(parseAvatarV2ReferenceManifest(approved)).toBeNull();
    const wrong = manifestWithMeasuredAnatomy();
    wrong.frames[0].sourceJointSuggestions.suggestions[2].position[0] = Number.NaN;
    expect(parseAvatarV2ReferenceManifest(wrong)).toBeNull();
    const missing = manifestWithMeasuredAnatomy();
    missing.frames[1].sourceJointSuggestions.suggestions.pop();
    expect(parseAvatarV2ReferenceManifest(missing)).toBeNull();
  });

  it('builds immutable preview-only asset paths, never production LOD paths', () => {
    expect(avatarV2ReferenceModelUrl('masculine', 'lookdev'))
      .toContain('masculine-LOOKDEV-ONLY-not-validated.glb');
    expect(avatarV2ReferenceImageUrl('feminine', 'source', 'face'))
      .toContain('feminine/feminine-face.png');
  });
});
