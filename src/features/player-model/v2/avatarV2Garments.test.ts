import { describe, expect, it } from 'vitest';
import * as T from 'three';
import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
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

function baseAvatar() {
  const root = new T.Group();

  const hips = new T.Bone();
  hips.name = 'Hips';
  root.add(hips);

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

function garmentSource(boneName = 'hips', includeUnskinned = false) {
  const root = new T.Group();
  const bone = new T.Bone();
  bone.name = boneName;
  root.add(bone);

  const geometry = new T.BoxGeometry(.48, .62, .27, 2, 2, 2);
  const count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) weights[index * 4] = 1;
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));

  const material = new T.MeshStandardMaterial({ color: '#ffffff' });
  material.name = 'RMV2_Garment_Main';
  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.name = 'RMV2_Test_Tee';
  mesh.bind(new T.Skeleton([bone]));
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

    const result = buildAvatarV2Garments(library, root, [clothing], 'masculine', 1);
    expect(result.hiddenBodyRegions).toEqual(['torso']);
    expect(torso.visible).toBe(false);

    const garment = result.group.getObjectByName('RMV2_Test_Tee') as T.SkinnedMesh;
    expect(garment).toBeInstanceOf(T.SkinnedMesh);
    expect(garment.skeleton.bones[0].name).toBe('Hips');
    expect(garment.userData.rockmundoAvatarV2Garment).toBe(true);
    const material = garment.material as T.MeshStandardMaterial;
    expect(material.color.getHexString()).toBe('bd3548');
  });

  it('rejects detached rigid garment details instead of allowing them to float', () => {
    const { root, torso } = baseAvatar();
    const clothing = row();
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[file, garmentSource('hips', true)]]);

    expect(() => buildAvatarV2Garments(library, root, [clothing], 'masculine', 1))
      .toThrow(/unskinned mesh/);
    expect(torso.visible).toBe(true);
  });

  it('fails closed when clothing would clip because a required body region is not authored', () => {
    const { root } = baseAvatar();
    root.getObjectByName('RMV2_Body_Torso')?.removeFromParent();
    const clothing = row();
    const file = avatarV2GarmentFile(clothing.item, 'masculine', 1)!;
    const library = new Map<string, T.Object3D>([[file, garmentSource('hips')]]);

    expect(() => buildAvatarV2Garments(library, root, [clothing], 'masculine', 1))
      .toThrow(/body region/);
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
