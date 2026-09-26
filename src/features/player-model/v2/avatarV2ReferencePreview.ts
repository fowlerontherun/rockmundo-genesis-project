import type { AvatarV2Frame } from './avatarV2Contract';

export type AvatarV2ReferenceVariant = 'source' | 'lookdev' | 'headMotion';
export type AvatarV2ReferenceView = 'front' | 'quarter' | 'side' | 'face';
export type AvatarV2StarterTeeStyle =
  'logo-tee' | 'plain-black-tee' | 'plain-white-tee' | 'vintage-charcoal-tee';

const REFERENCE_BASE =
  'https://raw.githubusercontent.com/fowlerontherun/rockmundo-genesis-project/avatar-v2-reference-previews';
const FRAMES: readonly AvatarV2Frame[] = ['masculine', 'feminine'];
const VIEWS: readonly AvatarV2ReferenceView[] = ['front', 'quarter', 'side', 'face'];
const STARTER_TEE_KEYS: Readonly<Record<AvatarV2StarterTeeStyle, string>> = {
  'logo-tee': 'clothing.starter.logo-tee',
  'plain-black-tee': 'clothing.starter.plain-black-tee',
  'plain-white-tee': 'clothing.starter.plain-white-tee',
  'vintage-charcoal-tee': 'clothing.starter.vintage-charcoal-tee',
};

export type AvatarV2SourceJointBone = 'Eye.L' | 'Eye.R' | 'EarAnchor.L' | 'EarAnchor.R';

export interface AvatarV2SourceJointSuggestion {
  bone: AvatarV2SourceJointBone;
  position: [number, number, number]; // Measured Blender world metres, Z up, -Y forward.
  armatureLocal: [number, number, number];
  sourceMesh: string;
  sourceSamples: number;
  realSourceGeometry: true;
  artistReviewed: false;
}

export interface AvatarV2SourceJointEvidence {
  schema: 'rockmundo.avatar-v2-source-joint-suggestions';
  version: 1;
  frame: AvatarV2Frame;
  source: 'actual CC0 eyeball and continuous body vertices';
  eyeRadiiMm: { L: number; R: number };
  artistReviewed: false;
  rigFitted: false;
  skinWeightsAuthored: false;
  suggestions: AvatarV2SourceJointSuggestion[];
}

export interface AvatarV2HeadMotionEvidence {
  schema: 'rockmundo.avatar-v2-head-rig-experiment';
  version: 1;
  frame: AvatarV2Frame;
  headTurnDegrees: 16;
  eyeCounterTurnDegrees: -7;
  headMeanDisplacementMm: number;
  torsoMeanDisplacementMm: number;
  eyeMeanDisplacementMm: { L: number; R: number };
  gltfJointCount: number;
  gltfSkinnedPrimitives: number;
  actualSkinBuffers: true;
  draftWeightsOnly: true;
  guideHeadPivotStillUnfitted: true;
  artistReviewed: false;
  fullBodySkinned: false;
  faceMorphsAuthored: false;
  productionValidated: false;
}

export interface AvatarV2StarterTeeProof {
  style: AvatarV2StarterTeeStyle;
  catalogueKey: string;
  preview: string;
  views: { front: string; quarter: string };
  evidence: {
    sourceSurfaceVertices: number;
    sourceSelectedFaces: number;
    averageOffsetMm: number;
    actualOriginalCC0SourceSurface: true;
    gltfConformingOriginalLogo: boolean;
    gltfRealSurfaceHems: true;
    realGarmentArtistApproved: false;
    requiresManualFullBodyRigAndGarmentWeighting: true;
    productionValidated: false;
  };
}

interface ReferenceFrame {
  frame: AvatarV2Frame;
  source: string;
  lookdev: string;
  sourceViews: Record<AvatarV2ReferenceView, string>;
  lookdevViews: Record<AvatarV2ReferenceView, string>;
  headMotion?: string;
  headMotionViews?: Record<AvatarV2ReferenceView, string>;
  headMotionEvidence?: AvatarV2HeadMotionEvidence;
  starterTees?: AvatarV2StarterTeeProof[];
  // Optional for the older gallery manifest, but strictly verified when present.
  sourceJointSuggestions?: AvatarV2SourceJointEvidence;
}

export interface AvatarV2ReferenceManifest {
  schema: 'rockmundo.avatar-v2-reference-previews';
  version: 1;
  source: 'blender-human-base-meshes-v1.4.1';
  previewOnly: true;
  productionValidated: false;
  frames: ReferenceFrame[];
  files: Array<{ file: string; bytes: number; sha256: string }>;
}

/** Blender uses Z-up and -Y forward. The authored GLB contract is +Y-up and +Z forward. */
export function avatarV2SourceWorldToGltf(point: readonly [number, number, number]): [number, number, number] {
  return [point[0], point[2], -point[1]];
}

export const avatarV2ReferenceManifestUrl = `${REFERENCE_BASE}/preview-manifest.json`;

export function avatarV2ReferenceModelUrl(frame: AvatarV2Frame, variant: AvatarV2ReferenceVariant) {
  const role = variant === 'lookdev' ? 'LOOKDEV-ONLY' :
    variant === 'headMotion' ? 'HEAD-RIG-EXPERIMENT' : 'SOURCE-ONLY';
  return `${REFERENCE_BASE}/${frame}/${frame}-${role}-not-validated.glb`;
}

export function avatarV2StarterTeeModelUrl(frame: AvatarV2Frame, style: AvatarV2StarterTeeStyle) {
  return `${REFERENCE_BASE}/${frame}/${frame}-starter-${style}-LOOKDEV-ONLY-not-validated.glb`;
}

export function avatarV2StarterTeeImageUrl(
  frame: AvatarV2Frame, style: AvatarV2StarterTeeStyle, view: 'front' | 'quarter',
) {
  return `${REFERENCE_BASE}/${frame}/${frame}-starter-${style}-${view}.png`;
}

export function avatarV2ReferenceImageUrl(
  frame: AvatarV2Frame,
  variant: AvatarV2ReferenceVariant,
  view: AvatarV2ReferenceView,
) {
  const prefix = variant === 'lookdev' ? 'lookdev-' :
    variant === 'headMotion' ? 'head-rig-experiment-' : '';
  return `${REFERENCE_BASE}/${frame}/${frame}-${prefix}${view}.png`;
}

/**
 * The gallery is deliberately stricter than an arbitrary remote image viewer.
 * Only a complete, explicitly non-production, source-verified pair is shown.
 * The asset names are reconstructed locally, never taken as arbitrary URLs
 * from the remote manifest. This is a *preview* check, not the GLB release gate.
 */
export function parseAvatarV2ReferenceManifest(raw: unknown): AvatarV2ReferenceManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const manifest = raw as Record<string, unknown>;
  if (manifest.schema !== 'rockmundo.avatar-v2-reference-previews' ||
      manifest.version !== 1 ||
      manifest.source !== 'blender-human-base-meshes-v1.4.1' ||
      manifest.previewOnly !== true ||
      manifest.productionValidated !== false ||
      !Array.isArray(manifest.frames) ||
      manifest.frames.length !== 2 ||
      !Array.isArray(manifest.files)) return null;

  const inventory = new Map<string, { bytes: number; sha256: string }>();
  for (const entry of manifest.files) {
    if (!entry || typeof entry !== 'object') return null;
    const file = entry as Record<string, unknown>;
    if (typeof file.file !== 'string' || typeof file.bytes !== 'number' ||
        !Number.isInteger(file.bytes) || file.bytes < 1024 ||
        typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256) ||
        inventory.has(file.file)) return null;
    inventory.set(file.file, { bytes: file.bytes, sha256: file.sha256 });
  }

  for (const frame of FRAMES) {
    const item = manifest.frames.find((candidate: unknown) =>
      !!candidate && typeof candidate === 'object' && (candidate as Record<string, unknown>).frame === frame,
    ) as Record<string, unknown> | undefined;
    if (!item) return null;
    const expected = (variant: AvatarV2ReferenceVariant, view?: AvatarV2ReferenceView) =>
      view
        ? `${frame}/${frame}-${variant === 'lookdev' ? 'lookdev-' : variant === 'headMotion' ? 'head-rig-experiment-' : ''}${view}.png`
        : `${frame}/${frame}-${variant === 'lookdev' ? 'LOOKDEV-ONLY' : variant === 'headMotion' ? 'HEAD-RIG-EXPERIMENT' : 'SOURCE-ONLY'}-not-validated.glb`;
    if (item.source !== expected('source') || item.lookdev !== expected('lookdev')) return null;
    if (item.sourceJointSuggestions !== undefined) {
      const evidence = item.sourceJointSuggestions;
      if (!evidence || typeof evidence !== 'object') return null;
      const joints = evidence as Record<string, unknown>;
      const radii = joints.eyeRadiiMm;
      if (joints.schema !== 'rockmundo.avatar-v2-source-joint-suggestions' ||
          joints.version !== 1 || joints.frame !== frame ||
          joints.source !== 'actual CC0 eyeball and continuous body vertices' ||
          joints.artistReviewed !== false || joints.rigFitted !== false ||
          joints.skinWeightsAuthored !== false ||
          !radii || typeof radii !== 'object' ||
          ![...['L', 'R']].every(side => {
            const value = (radii as Record<string, unknown>)[side];
            return typeof value === 'number' && Number.isFinite(value) && value >= 22 && value <= 50;
          }) || !Array.isArray(joints.suggestions) || joints.suggestions.length !== 4) return null;
      const names = new Set<AvatarV2SourceJointBone>();
      for (const candidate of joints.suggestions) {
        if (!candidate || typeof candidate !== 'object') return null;
        const point = candidate as Record<string, unknown>;
        const bone = point.bone as AvatarV2SourceJointBone;
        if (!(['Eye.L', 'Eye.R', 'EarAnchor.L', 'EarAnchor.R'] as string[]).includes(bone) ||
            names.has(bone) ||
            point.realSourceGeometry !== true || point.artistReviewed !== false ||
            typeof point.sourceMesh !== 'string' || !point.sourceMesh ||
            typeof point.sourceSamples !== 'number' || !Number.isInteger(point.sourceSamples) ||
            point.sourceSamples < (bone.startsWith('Eye.') ? 50 : 6) ||
            ![point.position, point.armatureLocal].every(coordinates =>
              Array.isArray(coordinates) && coordinates.length === 3 &&
              coordinates.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 5)
            )) return null;
        names.add(bone);
      }
    }

    if (item.starterTees !== undefined) {
      if (!Array.isArray(item.starterTees) || item.starterTees.length !== 4) return null;
      const styles = new Set<AvatarV2StarterTeeStyle>();
      for (const tee of item.starterTees) {
        if (!tee || typeof tee !== 'object') return null;
        const proof = tee as AvatarV2StarterTeeProof;
        const style = proof.style;
        if (!Object.prototype.hasOwnProperty.call(STARTER_TEE_KEYS, style) || styles.has(style) ||
            proof.catalogueKey !== STARTER_TEE_KEYS[style]) return null;
        styles.add(style);
        const glb = `${frame}/${frame}-starter-${style}-LOOKDEV-ONLY-not-validated.glb`;
        if (proof.preview !== glb || !inventory.has(glb) ||
            !proof.views || typeof proof.views !== 'object') return null;
        for (const view of ['front', 'quarter'] as const) {
          const image = `${frame}/${frame}-starter-${style}-${view}.png`;
          if (proof.views[view] !== image || !inventory.has(image)) return null;
        }
        const evidence = proof.evidence;
        if (!evidence || evidence.actualOriginalCC0SourceSurface !== true ||
            evidence.gltfRealSurfaceHems !== true ||
            evidence.realGarmentArtistApproved !== false ||
            evidence.requiresManualFullBodyRigAndGarmentWeighting !== true ||
            evidence.productionValidated !== false ||
            evidence.gltfConformingOriginalLogo !== (style === 'logo-tee') ||
            !Number.isInteger(evidence.sourceSurfaceVertices) ||
            evidence.sourceSurfaceVertices < 350 ||
            !Number.isInteger(evidence.sourceSelectedFaces) ||
            evidence.sourceSelectedFaces < 350 ||
            !Number.isFinite(evidence.averageOffsetMm) ||
            evidence.averageOffsetMm < 13 || evidence.averageOffsetMm > 15) return null;
      }
    }
    for (const variant of ['source', 'lookdev'] as const) {
      const views = item[`${variant}Views`];
      if (!views || typeof views !== 'object') return null;
      for (const view of VIEWS) {
        if ((views as Record<string, unknown>)[view] !== expected(variant, view)) return null;
        if (!inventory.has(expected(variant, view))) return null;
      }
      if (!inventory.has(expected(variant))) return null;
    }
    const hasHeadMotion = ['headMotion', 'headMotionViews', 'headMotionEvidence']
      .some(name => item[name] !== undefined);
    if (hasHeadMotion) {
      if (item.headMotion !== expected('headMotion') ||
          !inventory.has(expected('headMotion')) ||
          !item.headMotionViews || typeof item.headMotionViews !== 'object') return null;
      for (const view of VIEWS) {
        if ((item.headMotionViews as Record<string, unknown>)[view] !== expected('headMotion', view) ||
            !inventory.has(expected('headMotion', view))) return null;
      }
      const proof = item.headMotionEvidence;
      if (!proof || typeof proof !== 'object') return null;
      const motion = proof as Record<string, unknown>;
      const eyes = motion.eyeMeanDisplacementMm;
      if (motion.schema !== 'rockmundo.avatar-v2-head-rig-experiment' ||
          motion.version !== 1 || motion.frame !== frame ||
          motion.headTurnDegrees !== 16 || motion.eyeCounterTurnDegrees !== -7 ||
          motion.actualSkinBuffers !== true ||
          motion.draftWeightsOnly !== true ||
          motion.guideHeadPivotStillUnfitted !== true ||
          motion.artistReviewed !== false ||
          motion.fullBodySkinned !== false ||
          motion.faceMorphsAuthored !== false ||
          motion.productionValidated !== false ||
          typeof motion.gltfJointCount !== 'number' || motion.gltfJointCount < 5 ||
          typeof motion.gltfSkinnedPrimitives !== 'number' || motion.gltfSkinnedPrimitives < 3 ||
          typeof motion.headMeanDisplacementMm !== 'number' ||
          !Number.isFinite(motion.headMeanDisplacementMm) ||
          motion.headMeanDisplacementMm < 4 || motion.headMeanDisplacementMm > 500 ||
          typeof motion.torsoMeanDisplacementMm !== 'number' ||
          !Number.isFinite(motion.torsoMeanDisplacementMm) ||
          motion.torsoMeanDisplacementMm < 0 || motion.torsoMeanDisplacementMm > .5 ||
          !eyes || typeof eyes !== 'object' ||
          !(['L', 'R'] as const).every(side => {
            const value = (eyes as Record<string, unknown>)[side];
            return typeof value === 'number' && Number.isFinite(value) &&
              value >= 4 && value <= 500;
          })) return null;
    }
  }
  // The new deformed reference must be published for BOTH frame types, or
  // neither: never quietly show the new V2 proof for only one body.
  if (manifest.frames.some((item: ReferenceFrame) => !!item.headMotion) &&
      !manifest.frames.every((item: ReferenceFrame) => !!item.headMotion)) return null;

  // The new Starter Wardrobe proof must cover all four unchanged existing
  // catalogue keys on BOTH real CC0 body frames, or neither.
  if (manifest.frames.some((item: ReferenceFrame) => !!item.starterTees) &&
      !manifest.frames.every((item: ReferenceFrame) => !!item.starterTees)) return null;

  return manifest as unknown as AvatarV2ReferenceManifest;
}
