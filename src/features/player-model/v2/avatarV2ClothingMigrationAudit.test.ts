import { describe, expect, it } from 'vitest';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { auditAvatarV2ClothingCatalog } from './avatarV2ClothingMigrationAudit';

const packs = [
  { id: 'starter', name: 'Starter Wardrobe' },
  { id: 'punk', name: 'Punk Essentials' },
];

function garment(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: 'tee', name: 'Existing Logo Tee', description: null,
    category: 'top', wearable_slot: 'top',
    price: 80, is_premium: false, rarity: 'common',
    color_variants: [], collection_id: 'starter',
    release_date: null, expiry_date: null, is_limited_edition: false,
    featured: true, rpm_asset_id: null,
    curated_asset_key: 'clothing.starter.logo-tee',
    curated_asset_status: 'published', preview_status: 'pending',
    bonus_enabled: true, bonus_config: { daily_xp: 2 },
    garment_config: {},
    ...overrides,
  };
}

const fullV2 = {
  avatarV2: {
    version: 1, status: 'validated',
    frames: Object.fromEntries(['masculine', 'feminine'].map(frame => [
      frame,
      Object.fromEntries([0, 1, 2, 3].map(lod => [
        `lod${lod}`, `avatar-v2/clothing/${frame}/logo-tee-lod${lod}.glb`,
      ])),
    ])),
    occludeBodyRegions: ['torso'],
    colourMode: 'zones',
    materialZones: { main: ['RMV2_Main'], trim: ['RMV2_Trim'] },
  },
};

describe('existing owned clothing -> Avatar V2 migration audit', () => {
  it('prioritizes published items, reports pending previews, and preserves catalogue records', () => {
    const items = [
      garment(),
      garment({ id: 'punk', name: 'Patch Jacket', curated_asset_key: 'clothing.punk.patch-jacket',
        curated_asset_status: 'blocked', collection_id: 'punk', wearable_slot: 'outerwear',
        bonus_enabled: false, preview_status: 'ready' }),
      garment({ id: 'old', name: 'Owned Legacy Jacket', curated_asset_key: null,
        curated_asset_status: 'legacy', collection_id: null, wearable_slot: null,
        bonus_enabled: false, preview_status: 'ready' }),
    ];
    const snapshot = JSON.stringify(items);
    const audit = auditAvatarV2ClothingCatalog(items, packs);
    expect(audit.total).toBe(3);
    expect(audit.published).toBe(1);
    expect(audit.blocked).toBe(1);
    expect(audit.legacy).toBe(1);
    expect(audit.unassigned).toBe(1);
    expect(audit.publishedPendingPreviews).toBe(1);
    expect(audit.existingBonuses).toBe(1);
    expect(audit.rows.map(row => row.wave)).toEqual([
      '1-published', '2-blocked', '3-legacy',
    ]);
    expect(audit.rows[0].issues).toContain('missing-v2-mapping');
    expect(audit.rows[0].issues).toContain('preview-metadata-pending');
    expect(audit.rows[1].issues).toContain('blocked-item');
    expect(audit.rows[2].issues).toContain('legacy-review');
    expect(audit.rows[2].issues).toContain('missing-stable-key');
    expect(JSON.stringify(items)).toBe(snapshot);
  });

  it('does not count a status label as ready without BOTH frames and all LOD paths', () => {
    const partial = {
      avatarV2: {
        ...fullV2.avatarV2,
        frames: { masculine: { lod0: 'avatar-v2/clothing/masculine/tee-lod0.glb' } },
      },
    };
    const result = auditAvatarV2ClothingCatalog([
      garment({ garment_config: partial, preview_status: 'ready' }),
    ], packs);
    expect(result.v2Mapped).toBe(1);
    expect(result.v2MappingComplete).toBe(0);
    expect(result.rows[0].issues).toEqual(expect.arrayContaining([
      'incomplete-v2-frames', 'missing-v2-lods',
    ]));
  });

  it('only flags complete inventory metadata; separate real GLB and artist QA are still required', () => {
    const result = auditAvatarV2ClothingCatalog([
      garment({ preview_status: 'ready', garment_config: fullV2 }),
    ], packs);
    expect(result.v2Mapped).toBe(1);
    expect(result.v2MappingComplete).toBe(1);
    expect(result.publishedMissingV2).toBe(0);
    expect(result.publishedPendingPreviews).toBe(0);
    expect(result.rows[0].hasBonuses).toBe(true);
  });

  it('catches duplicate keys and unsafe colour-zone/coverage omissions', () => {
    const missing = {
      avatarV2: {
        ...fullV2.avatarV2,
        occludeBodyRegions: [], materialZones: { main: [], trim: [] },
      },
    };
    const items = [
      garment({ garment_config: missing }),
      garment({ id: 'clone', name: 'Wrong Duplicate', garment_config: missing }),
    ];
    const result = auditAvatarV2ClothingCatalog(items, packs);
    expect(result.rows).toHaveLength(2);
    for (const row of result.rows) {
      expect(row.issues).toEqual(expect.arrayContaining([
        'duplicate-stable-key', 'missing-body-occlusion', 'missing-colour-zones',
      ]));
      expect(row.v2MappingComplete).toBe(false);
    }
  });
  it('rejects a single proof file reused across frames or LODs without touching paid inventory', () => {
    const repeated = {
      avatarV2: {
        ...fullV2.avatarV2,
        frames: {
          ...fullV2.avatarV2.frames,
          feminine: {
            ...fullV2.avatarV2.frames.feminine,
            lod2: fullV2.avatarV2.frames.masculine.lod2,
          },
        },
      },
    };
    const existing = garment({ garment_config: repeated, preview_status: 'ready' });
    const before = JSON.stringify(existing);
    const result = auditAvatarV2ClothingCatalog([existing], packs);
    expect(result.rows[0].issues).toContain('reused-v2-lod-file');
    expect(result.rows[0].v2MappingComplete).toBe(false);
    expect(result.publishedMissingV2).toBe(1);
    expect(existing.id).toBe('tee');
    expect(existing.bonus_config).toEqual({ daily_xp: 2 });
    expect(JSON.stringify(existing)).toBe(before);
  });

  it('does not count duplicate existing identities or curated keys as complete mappings', () => {
    const result = auditAvatarV2ClothingCatalog([
      garment({ garment_config: fullV2, preview_status: 'ready' }),
      garment({ garment_config: fullV2, preview_status: 'ready' }),
    ], packs);
    expect(result.v2MappingComplete).toBe(0);
    expect(result.publishedMissingV2).toBe(2);
    for (const row of result.rows) {
      expect(row.issues).toContain('duplicate-item-id');
      expect(row.issues).toContain('duplicate-stable-key');
      expect(row.v2MappingComplete).toBe(false);
    }
  });

  it('flags two different existing garments pointing to the same V2 files', () => {
    const result = auditAvatarV2ClothingCatalog([
      garment({ garment_config: fullV2, preview_status: 'ready' }),
      garment({ id: 'second', curated_asset_key: 'clothing.starter.second',
        garment_config: fullV2, preview_status: 'ready' }),
    ], packs);
    expect(result.v2MappingComplete).toBe(0);
    for (const row of result.rows) {
      expect(row.issues).toContain('shared-v2-file-between-items');
      expect(row.issues).not.toContain('duplicate-item-id');
      expect(row.issues).not.toContain('duplicate-stable-key');
    }
  });

  it('does not certify a V2 mapping without its original stable curated key', () => {
    const existing = garment({
      curated_asset_key: null, garment_config: fullV2, preview_status: 'ready',
    });
    const snapshot = JSON.stringify(existing);
    const result = auditAvatarV2ClothingCatalog([existing], packs);
    expect(result.rows[0].issues).toContain('missing-stable-key');
    expect(result.rows[0].v2MappingComplete).toBe(false);
    expect(result.publishedMissingV2).toBe(1);
    expect(JSON.stringify(existing)).toBe(snapshot);
  });

});
