import * as T from 'three';
import type { PlayerAppearance } from '../appearance';

export type AvatarV2CustomizationMorph =
  | 'bodySlim'
  | 'bodyBroad'
  | 'muscleToned'
  | 'muscleAthletic'
  | 'muscleMuscular'
  | 'muscleBodybuilder'
  | 'faceOval'
  | 'faceAngular'
  | 'faceSoft'
  | 'faceWide';

const ALIASES: Record<AvatarV2CustomizationMorph, string[]> = {
  bodySlim: ['bodySlim', 'body_slim', 'bodyLean', 'body_lean', 'shapeSlim'],
  bodyBroad: ['bodyBroad', 'body_broad', 'shapeBroad'],
  muscleToned: ['muscleToned', 'muscle_toned', 'bodyToned', 'body_toned'],
  muscleAthletic: ['muscleAthletic', 'muscle_athletic', 'bodyAthletic', 'body_athletic'],
  muscleMuscular: ['muscleMuscular', 'muscle_muscular', 'bodyMuscular', 'body_muscular'],
  muscleBodybuilder: ['muscleBodybuilder', 'muscle_bodybuilder', 'bodyBodybuilder', 'body_bodybuilder'],
  faceOval: ['faceOval', 'face_oval', 'headOval'],
  faceAngular: ['faceAngular', 'face_angular', 'headAngular'],
  faceSoft: ['faceSoft', 'face_soft', 'headSoft'],
  faceWide: ['faceWide', 'face_wide', 'headWide'],
};

const clean = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

interface MorphBinding {
  mesh: T.Mesh;
  index: number;
}

type BindingMap = Partial<Record<AvatarV2CustomizationMorph, MorphBinding[]>>;

function bindingsFor(root: T.Object3D): BindingMap {
  const result: BindingMap = {};
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || !node.morphTargetDictionary || !node.morphTargetInfluences) return;
    const available = new Map(Object.entries(node.morphTargetDictionary).map(([name, index]) => [clean(name), index]));

    for (const morph of Object.keys(ALIASES) as AvatarV2CustomizationMorph[]) {
      const index = [morph, ...ALIASES[morph]]
        .map(clean)
        .map(name => available.get(name))
        .find(value => value !== undefined);
      if (index === undefined) continue;
      (result[morph] ??= []).push({ mesh: node, index });
    }
  });
  return result;
}

function weight(bindings: BindingMap, morph: AvatarV2CustomizationMorph, value: number) {
  const next = T.MathUtils.clamp(value, 0, 1);
  for (const binding of bindings[morph] ?? []) {
    if (!binding.mesh.morphTargetInfluences) continue;
    binding.mesh.morphTargetInfluences[binding.index] = next;
  }
}

export interface AvatarV2CustomizationResult {
  bodyBuildApplied: boolean;
  muscleApplied: boolean;
  faceShapeApplied: boolean;
  supported: AvatarV2CustomizationMorph[];
}

/**
 * Applies authored body/face shape keys without stretching the skeleton. This is
 * the preferred V2 path; V1's whole-root X/Z build scaling remains a fallback
 * when a candidate does not provide the body shape keys yet.
 */
export function applyAvatarV2Customization(
  root: T.Object3D,
  appearance: PlayerAppearance,
): AvatarV2CustomizationResult {
  const bindings = bindingsFor(root);
  const supported = (Object.keys(bindings) as AvatarV2CustomizationMorph[])
    .filter(key => (bindings[key]?.length ?? 0) > 0);

  for (const morph of Object.keys(ALIASES) as AvatarV2CustomizationMorph[]) weight(bindings, morph, 0);

  const delta = appearance.body.build - 1;
  let bodyBuildApplied = false;
  if (delta < -.001 && supported.includes('bodySlim')) {
    weight(bindings, 'bodySlim', Math.abs(delta) / .15);
    bodyBuildApplied = true;
  } else if (delta > .001 && supported.includes('bodyBroad')) {
    weight(bindings, 'bodyBroad', delta / .15);
    bodyBuildApplied = true;
  } else if (Math.abs(delta) <= .001) {
    bodyBuildApplied = supported.includes('bodySlim') && supported.includes('bodyBroad');
  }

  const muscleMap: Partial<Record<NonNullable<PlayerAppearance['body']['muscle']>, AvatarV2CustomizationMorph>> = {
    toned: 'muscleToned',
    athletic: 'muscleAthletic',
    muscular: 'muscleMuscular',
    bodybuilder: 'muscleBodybuilder',
  };
  const selectedMuscle = appearance.body.muscle ?? 'natural';
  const muscleMorph = muscleMap[selectedMuscle];
  const muscleApplied = selectedMuscle === 'natural' || (!!muscleMorph && supported.includes(muscleMorph));
  if (muscleMorph) weight(bindings, muscleMorph, 1);

  const faceMap: Partial<Record<NonNullable<PlayerAppearance['head']['faceShape']>, AvatarV2CustomizationMorph>> = {
    oval: 'faceOval',
    angular: 'faceAngular',
    soft: 'faceSoft',
    wide: 'faceWide',
  };
  const faceMorph = faceMap[appearance.head.faceShape ?? 'classic'];
  const faceShapeApplied = !!faceMorph && supported.includes(faceMorph);
  if (faceMorph) weight(bindings, faceMorph, 1);

  root.userData.rockmundoV2UsesBuildMorph = bodyBuildApplied;
  root.userData.rockmundoV2UsesMuscleMorph = muscleApplied;
  root.userData.rockmundoV2UsesFaceMorph = faceShapeApplied;
  return { bodyBuildApplied, muscleApplied, faceShapeApplied, supported };
}

export const AVATAR_V2_CUSTOMIZATION_MORPHS = Object.freeze(Object.keys(ALIASES) as AvatarV2CustomizationMorph[]);
