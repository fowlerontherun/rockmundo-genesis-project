import * as T from 'three';
import { collectAvatarV2ExpressionBindings } from './avatarV2Expressions';

/**
 * Read-only Phase 2 candidate audit. A pass here is structural evidence only:
 * visual fit, deformation, authored source files and both-frame close-up review
 * are separate release requirements.
 */
export const REQUIRED_FACE_CHANNELS = [
  'eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen',
  'mouthClose', 'mouthFunnel', 'mouthPucker',
  'mouthSmileLeft', 'mouthSmileRight',
  'browInnerUp', 'browDownLeft', 'browDownRight',
  'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight',
  'visemeAA', 'visemeEE', 'visemeIH', 'visemeOH', 'visemeOU',
] as const;

export const REQUIRED_HEAD_ANCHORS = [
  'Head', 'Eye.L', 'Eye.R', 'EarAnchor.L', 'EarAnchor.R',
] as const;

export interface AvatarV2FaceAudit {
  passed: boolean;
  missingChannels: string[];
  missingAnchors: string[];
  invalidMorphTargets: string[];
  invalidBaseMeshes: string[];
  duplicateAnchors: string[];
  missingRuntimeExpressions: string[];
}

/** Check actual loaded candidate geometry, not catalogue metadata. */
export function auditAvatarV2Face(root: T.Object3D): AvatarV2FaceAudit {
  const anchors = new Map<string, number>();
  const channels = new Set<string>();
  const invalidMorphTargets: string[] = [];
  const invalidBaseMeshes: string[] = [];
  root.traverse(node => {
    if (node instanceof T.Bone && REQUIRED_HEAD_ANCHORS.includes(node.name as typeof REQUIRED_HEAD_ANCHORS[number])) {
      anchors.set(node.name, (anchors.get(node.name) ?? 0) + 1);
    }
    if (!(node instanceof T.Mesh)) return;
    const geometry = node.geometry;
    const positions = geometry.attributes.position;
    const morphs = geometry.morphAttributes.position ?? [];
    if (!positions || positions.itemSize !== 3 || positions.count === 0) {
      invalidBaseMeshes.push(node.name || '(unnamed mesh)');
    } else {
      for (let i = 0; i < positions.count; i++) {
        if (![positions.getX(i), positions.getY(i), positions.getZ(i)].every(Number.isFinite)) {
          invalidBaseMeshes.push(node.name || '(unnamed mesh)');
          break;
        }
      }
    }
    const dictionary = node.morphTargetDictionary ?? {};
    for (const [name, index] of Object.entries(dictionary)) {
      const target = morphs[index];
      if (!Number.isInteger(index) || index < 0 || !target || !positions || target.itemSize !== 3 || target.count !== positions.count) {
        invalidMorphTargets.push(`${node.name}:${name}`);
        continue;
      }
      let finite = true;
      for (let i = 0; i < target.count; i++) {
        if (!Number.isFinite(target.getX(i)) || !Number.isFinite(target.getY(i)) || !Number.isFinite(target.getZ(i))) {
          finite = false;
          break;
        }
      }
      if (!finite) invalidMorphTargets.push(`${node.name}:${name}`);
      else channels.add(name);
    }
  });
  const missingChannels = REQUIRED_FACE_CHANNELS.filter(name => !channels.has(name));
  const missingAnchors = REQUIRED_HEAD_ANCHORS.filter(name => !anchors.has(name));
  const duplicateAnchors = REQUIRED_HEAD_ANCHORS.filter(name => (anchors.get(name) ?? 0) > 1);
  // Structural completeness is distinct from what the shipped gig controller
  // can actually drive. Report both so exporters can fix naming mismatches.
  const bindings = collectAvatarV2ExpressionBindings(root);
  const runtimeRequired = ['blinkLeft', 'blinkRight', 'jawOpen', 'mouthSmile',
    'visemeAA', 'visemeEE', 'visemeIH', 'visemeOH', 'visemeOU'] as const;
  const missingRuntimeExpressions = runtimeRequired.filter(name => !(bindings[name]?.length));
  return {
    passed: !missingChannels.length && !missingAnchors.length && !duplicateAnchors.length && !invalidMorphTargets.length && !invalidBaseMeshes.length && !missingRuntimeExpressions.length,
    missingChannels, missingAnchors, duplicateAnchors, invalidMorphTargets, invalidBaseMeshes, missingRuntimeExpressions,
  };
}
