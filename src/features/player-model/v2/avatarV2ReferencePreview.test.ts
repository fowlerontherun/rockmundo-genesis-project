import { describe, expect, it } from 'vitest';
import {
  avatarV2ReferenceImageUrl,
  avatarV2ReferenceModelUrl,
  avatarV2SourceWorldToGltf,
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

function manifestWithRealHeadMotion() {
  const base = validManifest();
  return {
    ...base,
    frames: base.frames.map(frame => {
      const headMotion = `${frame.frame}/${frame.frame}-HEAD-RIG-EXPERIMENT-not-validated.glb`;
      const headMotionViews = Object.fromEntries(views.map(view => [
        view, `${frame.frame}/${frame.frame}-head-rig-experiment-${view}.png`,
      ]));
      [headMotion, ...Object.values(headMotionViews)].forEach(file =>
        base.files.push({ file, bytes: 4096, sha256: 'b'.repeat(64) }));
      return {
        ...frame, headMotion, headMotionViews,
        headMotionEvidence: {
          schema: 'rockmundo.avatar-v2-head-rig-experiment', version: 1,
          frame: frame.frame, headTurnDegrees: 16, eyeCounterTurnDegrees: -7,
          headMeanDisplacementMm: 25.6, torsoMeanDisplacementMm: 0.002,
          eyeMeanDisplacementMm: { L: 16.1, R: 16.4 },
          gltfJointCount: 62, gltfSkinnedPrimitives: 18,
          actualSkinBuffers: true, draftWeightsOnly: true,
          guideHeadPivotStillUnfitted: true, artistReviewed: false,
          fullBodySkinned: false, faceMorphsAuthored: false, productionValidated: false,
        },
      };
    }),
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

  it('converts exact Blender Z-up landmarks into +Y-up GLB coordinates', () => {
    expect(avatarV2SourceWorldToGltf([.052, -.036, 1.56])).toEqual([.052, 1.56, .036]);
    expect(avatarV2SourceWorldToGltf([-.052, .045, 1.50])).toEqual([-.052, 1.50, -.045]);
  });
  it('accepts only a complete real skinned head/eye proof for BOTH frame types', () => {
    const parsed = parseAvatarV2ReferenceManifest(manifestWithRealHeadMotion());
    expect(parsed?.frames[0].headMotionEvidence?.gltfSkinnedPrimitives).toBe(18);
    expect(parsed?.frames[1].headMotionEvidence?.productionValidated).toBe(false);
    expect(avatarV2ReferenceModelUrl('feminine', 'headMotion'))
      .toContain('feminine-HEAD-RIG-EXPERIMENT-not-validated.glb');
    expect(avatarV2ReferenceImageUrl('masculine', 'headMotion', 'face'))
      .toContain('masculine-head-rig-experiment-face.png');
  });

  it('rejects fake validated heads, missing proof images or no actual skin buffers', () => {
    const fake = manifestWithRealHeadMotion();
    fake.frames[0].headMotionEvidence.productionValidated = true;
    expect(parseAvatarV2ReferenceManifest(fake)).toBeNull();
    const bare = manifestWithRealHeadMotion();
    bare.frames[0].headMotionEvidence.actualSkinBuffers = false;
    expect(parseAvatarV2ReferenceManifest(bare)).toBeNull();
    const missing = manifestWithRealHeadMotion();
    missing.files.pop();
    expect(parseAvatarV2ReferenceManifest(missing)).toBeNull();
    const one = manifestWithRealHeadMotion();
    delete (one.frames[1] as Partial<typeof one.frames[number]>).headMotion;
    expect(parseAvatarV2ReferenceManifest(one)).toBeNull();
  });

  it('builds immutable preview-only asset paths, never production LOD paths', () => {
    expect(avatarV2ReferenceModelUrl('masculine', 'lookdev'))
      .toContain('masculine-LOOKDEV-ONLY-not-validated.glb');
    expect(avatarV2ReferenceImageUrl('feminine', 'source', 'face'))
      .toContain('feminine/feminine-face.png');
  });
});
