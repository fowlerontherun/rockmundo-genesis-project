import { describe, expect, it } from 'vitest';
import * as T from 'three';
import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { defaultAppearance, type PlayerAppearance } from '../appearance';
import {
  avatarV2ClothingCompatibilityReason,
  avatarV2GarmentConfig,
  avatarV2GarmentFile,
  buildAvatarV2Garments,
} from './avatarV2Garments';

function item(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: 'v2-tee',
    name: 'V2 Test Tee',
    description: null,
    category: 'top',
    wearable_slot: 'top',
    price: 0,
    is_premium: false,
    rarity: 'common',
    color_variants: [],
    collection_id: null,
    release_date: null,
    expiry_date: null,
    is_limited_edition: false,
    featured: false,
    rpm_asset_id: null,
    curated_asset_key: 'clothing.test.v2-tee',
    curated_asset_status: 'published',
    garment_config: {
      avatarV2: {
        version: 1,
        status: 'validated',
        frames: {
          masculine: {
            lod0: 'avatar-v2/clothing/masculine/test-tee-lod0.glb',
            lod1: 'avatar-v2/clothing/masculine/test-tee-lod1.glb',
          },
          feminine: {
            lod0: 'avatar-v2/clothing/feminine/test-tee-lod0.glb',
            lod1: 'avatar-v2/clothing/feminine/test-tee-lod1.glb',
          },
        },
        occludeBodyRegions: ['torso'],
        colourMode: 'zones',
        materialZones: {
          main: ['RMV2_Garment_Main'],
          trim: ['RMV2_Garment_Trim'],
        },
      },
    },
    ...overrides,
  };
}

function row(clothing = item()): ResolvedEquippedClothing {
  return {
    item: clothing,
    variant: {
      id: 'red',
      label: 'Red',
      color: '#bd3548',
      secondaryColor: '#d8ad49',
    },
  };
}

function appearance(body: Partial<PlayerAppearance['body']> = {}) {
  const value = defaultAppearance('avatar-v2-garment-test');
  return {
    ...value,
    body: { ...value.body, ...body },
  };
}

function baseAvatar() {
  const root = new T.Group();

  const hips = new T.Bone();
  hips.name = 'Hips';
  root.add(hips);
  for (const name of [
    'UpperArmTwist.L', 'UpperArmTwist.R',
    'ForearmTwist.L', 'ForearmTwist.R',
    'ThighTwist.L', 'ThighTwist.R',
  ]) {
    const bone = new T.Bone();
    bone.name = name;
    root.add(bone);
  }

  const torso = new T.Mesh(
    new T.BoxGeometry(.45, .65, .24),
    new T.MeshStandardMaterial({ color: '#c58c63' }),
  );
  torso.name = 'RMV2_Body_Torso';
  torso.userData.rockmundoBodyRegion = 'torso';
  torso.position.y = 1.05;
  root.add(torso);

  root.updateMatrixWorld(true);
  return { root, hips, torso };
}

function continuousMaterialAvatar() {
  const root = new T.Group();
  const hips = new T.Bone();
  hips.name = 'Hips';
  root.add(hips);

  const geometry = new T.BoxGeometry(.45, .65, .24);
  const torsoMaterial = new T.MeshStandardMaterial({ color: '#c58c63' });
  torsoMaterial.name = 'RMV2_Skin_Torso';
  const uncoveredMaterial = new T.MeshStandardMaterial({ color: '#c58c63' });
  uncoveredMaterial.name = 'RMV2_Skin';
  const mesh = new T.Mesh(geometry, [torsoMaterial, uncoveredMaterial]);
  mesh.name = 'RMV2_ContinuousBody';
  geometry.clearGroups();
  geometry.addGroup(0, 6, 0);
  geometry.addGroup(6, Math.max(3, (geometry.index?.count ?? 9) - 6), 1);
  root.add(mesh);
  root.updateMatrixWorld(true);
  return { root, mesh, torsoMaterial, uncoveredMaterial };
}

const POSE_CORRECTIVES = [
  'poseShoulderLeft', 'poseShoulderRight',
  'poseElbowLeft', 'poseElbowRight',
  'poseHipLeft', 'poseHipRight',
  'poseKneeLeft', 'poseKneeRight',
];

function garmentSource(
  boneName = 'hips',
  includeUnskinned = false,
  morphs: string[] = POSE_CORRECTIVES,
  extraWeightedBones: string[] = [],
) {
  const root = new T.Group();
  const bone = new T.Bone();
  bone.name = boneName;
  root.add(bone);
  const bones = [bone];
  const weightedExtras = extraWeightedBones.slice(0, 3);
  for (const name of weightedExtras) {
    const extra = new T.Bone();
    extra.name = name;
    root.add(extra);
    bones.push(extra);
  }

  const geometry = new T.BoxGeometry(.48, .62, .27, 2, 2, 2);
  const count = geometry.attributes.position.count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) {
    const extraShare = weightedExtras.length ? .5 / weightedExtras.length : 0;
    weights[index * 4] = weightedExtras.length ? .5 : 1;
    for (let extraIndex = 0; extraIndex < weightedExtras.length; extraIndex++) {
      indices[index * 4 + extraIndex + 1] = extraIndex + 1;
      weights[index * 4 + extraIndex + 1] = extraShare;
    }
  }
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));

  const material = new T.MeshStandardMaterial({ color: '#ffffff' });
  material.name = 'RMV2_Garment_Main';
  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.name = 'RMV2_Test_Tee';
  mesh.bind(new T.Skeleton(bones));
  if (morphs.length) {
    mesh.morphTargetDictionary = Object.fromEntries(morphs.map((name, index) => [name, index]));
    mesh.morphTargetInfluences = morphs.map(() => 0);
  }
  root.add(mesh);

  if (includeUnskinned) {
    const floating = new T.Mesh(
      new T.BoxGeometry(.02, .02, .02),
      new T.MeshStandardMaterial({ color: '#ffffff' }),
    );
    floating.name = 'FloatingBadge';
    root.add(floating);
  }

  root.updateMatrixWorld(true);
  return root;
}

describe('Avatar V2 garments', () => {
  it('parses only dedicated V2 clothing paths and exact LOD assets', () => {
    const config = avatarV2GarmentConfig(item());
    expect(config?.status).toBe('validated');
    expect(config?.occludeBodyRegions).toEqual(['torso']);
    expect(avatarV2GarmentFile(item(), 'masculine', 0))
      .toBe('avatar-v2/clothing/masculine/test-tee-lod0.glb');
    expect(avatarV2GarmentFile(item(), 'masculine', 2)).toBeNull();
  });

  it('keeps an item incompatible until its exact frame and LOD is validated', () => {
    const clothing = item({
      garment_config: {
        avatarV2: {
          version: 1,
          status: 'asset_ready',
          frames: { masculine: { lod1: 'avatar-v2/clothing/masculine/test.glb' } },
          occludeBodyRegions: ['torso'],
        },
      },
    });
    expect(avatarV2ClothingCompatibilityReason([row(clothing)], 'masculine', 1))
      .toContain('asset_ready');
  });

  it('rebinds semantic garment bones to the V2 runtime skeleton and hides covered body regions', () => {
    const { root, torso } = baseAvatar();
    const clothing = row();
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[file, garmentSource('hips')]]);

    const result = buildAvatarV2Garments(library, root, [clothing], appearance(), 1);
    expect(result.hiddenBodyRegions).toEqual(['torso']);
    expect(torso.visible).toBe(false);

    const garment = result.group.getObjectByName('RMV2_Test_Tee') as T.SkinnedMesh;
    expect(garment).toBeInstanceOf(T.SkinnedMesh);
    expect(garment.skeleton.bones[0].name).toBe('Hips');
    expect(garment.userData.rockmundoAvatarV2Garment).toBe(true);
    const material = garment.material as T.MeshStandardMaterial;
    expect(material.color.getHexString()).toBe('bd3548');
  });

  it('uses the Skin Store material profile and high-resolution weave fallback for close-up V2 garments', () => {
    const { root } = baseAvatar();
    const clothing = row(item({
      material_config: {
        fabric: 'denim',
        roughness: 82,
        metallic: 0,
        sheen: 6,
      },
    }));
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[file, garmentSource('hips')]]);

    const result = buildAvatarV2Garments(library, root, [clothing], appearance(), 1, 'high');
    const garment = result.group.getObjectByName('RMV2_Test_Tee') as T.SkinnedMesh;
    const material = garment.material as T.MeshPhysicalMaterial;

    expect(material).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(material.roughness).toBeCloseTo(.82);
    expect(material.metalness).toBe(0);
    expect(material.sheen).toBeCloseTo(.06);
    expect(material.normalMap).toBeInstanceOf(T.DataTexture);
    expect((material.normalMap as T.DataTexture).image.width).toBe(1024);
    expect(material.userData.rockmundoAvatarV2GarmentMaterial).toMatchObject({
      material: 'denim',
      quality: 'high',
      detailQuality: 'ultra',
      authoredNormal: false,
    });
  });

  it('preserves an authored V2 garment normal map instead of replacing it with fallback weave', () => {
    const { root } = baseAvatar();
    const clothing = row(item({ material_config: { fabric: 'cotton' } }));
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const source = garmentSource('hips');
    const sourceMesh = source.getObjectByName('RMV2_Test_Tee') as T.SkinnedMesh;
    const authoredNormal = new T.Texture();
    (sourceMesh.material as T.MeshStandardMaterial).normalMap = authoredNormal;
    const library = new Map<string, T.Object3D>([[file, source]]);

    const result = buildAvatarV2Garments(library, root, [clothing], appearance(), 1, 'high');
    const garment = result.group.getObjectByName('RMV2_Test_Tee') as T.SkinnedMesh;
    const material = garment.material as T.MeshPhysicalMaterial;

    expect(material).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(material.normalMap).not.toBe(authoredNormal);
    expect(material.normalMap).toBeInstanceOf(T.Texture);
    expect(material.normalMap).not.toBeInstanceOf(T.DataTexture);
    expect(material.userData.rockmundoAvatarV2GarmentMaterial.authoredNormal).toBe(true);
  });

  it('keeps medium-distance V2 garments on the standard shader path', () => {
    const { root } = baseAvatar();
    const clothingItem = item({
      material_config: { fabric: 'denim' },
      garment_config: {
        avatarV2: {
          version: 1,
          status: 'validated',
          frames: {
            masculine: { lod2: 'avatar-v2/clothing/masculine/test-tee-lod2.glb' },
          },
          occludeBodyRegions: ['torso'],
          colourMode: 'zones',
          materialZones: { main: ['RMV2_Garment_Main'], trim: [] },
        },
      },
    });
    const clothing = row(clothingItem);
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 2)!;
    const library = new Map<string, T.Object3D>([[file, garmentSource('hips')]]);

    const result = buildAvatarV2Garments(library, root, [clothing], appearance(), 2, 'balanced');
    const garment = result.group.getObjectByName('RMV2_Test_Tee') as T.SkinnedMesh;

    expect(garment.material).toBeInstanceOf(T.MeshStandardMaterial);
    expect(garment.material).not.toBeInstanceOf(T.MeshPhysicalMaterial);
    expect((garment.material as T.MeshStandardMaterial).normalMap).toBeNull();
  });

  it('gives reflective clothing materials physical response without fabric-weave fallback', () => {
    const { root } = baseAvatar();
    const clothing = row(item({
      material_config: {
        fabric: 'latex',
        roughness: 10,
        sheen: 85,
      },
    }));
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[file, garmentSource('hips')]]);

    const result = buildAvatarV2Garments(library, root, [clothing], appearance(), 1, 'high');
    const garment = result.group.getObjectByName('RMV2_Test_Tee') as T.SkinnedMesh;
    const material = garment.material as T.MeshPhysicalMaterial;

    expect(material).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(material.clearcoat).toBeGreaterThan(.8);
    expect(material.clearcoatRoughness).toBeLessThan(.1);
    expect(material.sheen).toBeCloseTo(.85);
    expect(material.normalMap).toBeNull();
  });

  it('occludes a continuous body region by material without hiding the whole mesh', () => {
    const { root, mesh, torsoMaterial, uncoveredMaterial } = continuousMaterialAvatar();
    const clothing = row();
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[file, garmentSource('hips')]]);

    const result = buildAvatarV2Garments(library, root, [clothing], appearance(), 1);
    expect(result.hiddenBodyRegions).toEqual(['torso']);
    expect(mesh.visible).toBe(true);
    expect(torsoMaterial.visible).toBe(false);
    expect(uncoveredMaterial.visible).toBe(true);
    expect(mesh.userData.rockmundoV2OccludedMaterialRegions).toEqual(['torso']);
  });

  it('applies the same build and muscle morphs to V2 body-worn garments', () => {
    const { root } = baseAvatar();
    const clothing = row();
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[
      file,
      garmentSource('hips', false, ['bodyBroad', 'muscleMuscular', ...POSE_CORRECTIVES]),
    ]]);
    const selected = appearance({ build: 1.15, muscle: 'muscular' });

    const result = buildAvatarV2Garments(library, root, [clothing], selected, 1);
    const garment = result.group.getObjectByName('RMV2_Test_Tee') as T.SkinnedMesh;
    const dictionary = garment.morphTargetDictionary!;
    const influences = garment.morphTargetInfluences!;

    expect(influences[dictionary.bodyBroad]).toBeCloseTo(1);
    expect(influences[dictionary.muscleMuscular]).toBeCloseTo(1);
    expect(garment.parent?.userData.rockmundoAvatarV2BodyBuild).toBe(1.15);
    expect(garment.parent?.userData.rockmundoAvatarV2Muscle).toBe('muscular');
  });

  it('fails closed when sleeves omit actual close-up twist weights', () => {
    const { root } = baseAvatar();
    const upperArms = new T.Mesh(
      new T.BoxGeometry(.04, .04, .04),
      new T.MeshStandardMaterial({ color: '#c58c63' }),
    );
    upperArms.name = 'RMV2_Body_UpperArms';
    upperArms.userData.rockmundoBodyRegion = 'upper-arms';
    root.add(upperArms);

    const clothingItem = item();
    const config = clothingItem.garment_config as unknown as { avatarV2: { occludeBodyRegions: string[] } };
    config.avatarV2.occludeBodyRegions = ['upper-arms'];
    const clothing = row(clothingItem);
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[file, garmentSource('hips')]]);

    expect(() => buildAvatarV2Garments(library, root, [clothing], appearance(), 1))
      .toThrow(/twist bone weight/);
  });

  it('rebinds sleeves that carry meaningful upper-arm twist weights', () => {
    const { root } = baseAvatar();
    const upperArms = new T.Mesh(
      new T.BoxGeometry(.04, .04, .04),
      new T.MeshStandardMaterial({ color: '#c58c63' }),
    );
    upperArms.name = 'RMV2_Body_UpperArms';
    upperArms.userData.rockmundoBodyRegion = 'upper-arms';
    root.add(upperArms);

    const clothingItem = item();
    const config = clothingItem.garment_config as unknown as { avatarV2: { occludeBodyRegions: string[] } };
    config.avatarV2.occludeBodyRegions = ['upper-arms'];
    const clothing = row(clothingItem);
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[
      file,
      garmentSource(
        'hips',
        false,
        POSE_CORRECTIVES,
        ['UpperArmTwist.L', 'UpperArmTwist.R'],
      ),
    ]]);

    expect(() => buildAvatarV2Garments(library, root, [clothing], appearance(), 1))
      .not.toThrow();
  });

  it('fails closed when a close-up body garment omits joint deformation correctives', () => {
    const { root, torso } = baseAvatar();
    const clothing = row();
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[
      file,
      garmentSource('hips', false, ['poseShoulderLeft']),
    ]]);

    expect(() => buildAvatarV2Garments(library, root, [clothing], appearance(), 1))
      .toThrow(/pose corrective morph/);
    expect(torso.visible).toBe(true);
  });

  it('fails closed instead of clipping a shaped body through an incompatible V2 garment', () => {
    const { root, torso } = baseAvatar();
    const clothing = row();
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[
      file,
      garmentSource('hips', false, POSE_CORRECTIVES),
    ]]);

    expect(() => buildAvatarV2Garments(
      library,
      root,
      [clothing],
      appearance({ build: 1.15, muscle: 'muscular' }),
      1,
    )).toThrow(/body-build morph/);
    expect(torso.visible).toBe(true);
  });

  it('rejects detached rigid garment details instead of allowing them to float', () => {
    const { root, torso } = baseAvatar();
    const clothing = row();
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[file, garmentSource('hips', true)]]);

    expect(() => buildAvatarV2Garments(library, root, [clothing], appearance(), 1))
      .toThrow(/unskinned mesh/);
    expect(torso.visible).toBe(true);
  });

  it('fails closed when clothing would clip because a required body region is not authored', () => {
    const { root } = baseAvatar();
    root.getObjectByName('RMV2_Body_Torso')?.removeFromParent();
    const clothing = row();
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[file, garmentSource('hips')]]);

    expect(() => buildAvatarV2Garments(library, root, [clothing], appearance(), 1))
      .toThrow(/body region/);
  });

  it('allows authored headwear and eyewear without fake body occlusion regions', () => {
    for (const wearable_slot of ['headwear', 'eyewear'] as const) {
      const accessory = item({
        id: `v2-${wearable_slot}`,
        name: `V2 Test ${wearable_slot}`,
        category: wearable_slot === 'headwear' ? 'hat' : 'glasses',
        wearable_slot,
        garment_config: {
          avatarV2: {
            version: 1,
            status: 'validated',
            frames: {
              masculine: { lod1: `avatar-v2/clothing/masculine/test-${wearable_slot}-lod1.glb` },
            },
            occludeBodyRegions: [],
            colourMode: 'authored',
            materialZones: { main: [], trim: [] },
          },
        },
      });
      expect(avatarV2ClothingCompatibilityReason([row(accessory)], 'masculine', 1)).toBeNull();
    }
  });

  it('rejects arbitrary URLs in V2 garment metadata', () => {
    const unsafe = item({
      garment_config: {
        avatarV2: {
          version: 1,
          status: 'validated',
          frames: { masculine: { lod0: 'https://example.com/avatar.glb' } },
          occludeBodyRegions: ['torso'],
        },
      },
    });
    expect(avatarV2GarmentFile(unsafe, 'masculine', 0)).toBeNull();
  });
});
