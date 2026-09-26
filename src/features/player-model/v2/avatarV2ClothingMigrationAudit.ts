import type { ClothingItem, SkinCollection } from '@/hooks/useSkinStore';
import { richGarmentSlot } from '@/features/clothing-preview/richGarmentVisuals';
import { avatarV2GarmentConfig } from './avatarV2Garments';

/**
 * Read-only transition audit. It uses the CURRENT owned/published catalogue
 * IDs, not replacement item IDs or a parallel pack list.
 *
 * The V2 source lookdev/head-motion proofs are not production bodies; no row
 * below promotes a clothing item to validated or changes store availability.
 */
export type ClothingMigrationIssue =
  | 'missing-stable-key'
  | 'duplicate-stable-key'
  | 'unassigned-pack'
  | 'missing-v2-mapping'
  | 'incomplete-v2-frames'
  | 'missing-v2-lods'
  | 'missing-body-occlusion'
  | 'missing-colour-zones'
  | 'preview-metadata-pending'
  | 'blocked-item'
  | 'legacy-review';

export type ClothingMigrationWave = '1-published' | '2-blocked' | '3-legacy' | '4-unreleased';

export interface ClothingMigrationRow {
  id: string;
  name: string;
  key: string | null;
  collectionId: string | null;
  collectionName: string;
  slot: ReturnType<typeof richGarmentSlot>;
  curatedStatus: string;
  v2Status: string;
  previewStatus: string;
  hasBonuses: boolean;
  wave: ClothingMigrationWave;
  issues: ClothingMigrationIssue[];
  /**
   * Only an inventory signal. Actual production use still requires an
   * independent artist QA sign-off, asset presence and the full release gate.
   */
  v2MappingComplete: boolean;
}

export interface ClothingMigrationSummary {
  total: number;
  published: number;
  legacy: number;
  blocked: number;
  unassigned: number;
  v2Mapped: number;
  v2MappingComplete: number;
  publishedMissingV2: number;
  publishedPendingPreviews: number;
  existingBonuses: number;
  byCollection: Array<{
    id: string;
    name: string;
    total: number;
    published: number;
    blocked: number;
    legacy: number;
    v2Mapped: number;
    v2MappingComplete: number;
  }>;
  rows: ClothingMigrationRow[];
}

const ALL_LODS = ['lod0', 'lod1', 'lod2', 'lod3'] as const;
const WAVES: readonly ClothingMigrationWave[] = [
  '1-published', '2-blocked', '3-legacy', '4-unreleased',
];

export function auditAvatarV2ClothingCatalog(
  items: readonly ClothingItem[],
  collections: readonly Pick<SkinCollection, 'id' | 'name'>[],
): ClothingMigrationSummary {
  const collectionNames = new Map(collections.map(collection => [collection.id, collection.name]));
  const keys = new Map<string, number>();
  for (const item of items) {
    const key = item.curated_asset_key?.trim();
    if (key) keys.set(key, (keys.get(key) ?? 0) + 1);
  }
  const rows: ClothingMigrationRow[] = items.map(item => {
    const status = item.curated_asset_status ?? 'legacy';
    const config = avatarV2GarmentConfig(item);
    const v2Status = config?.status ?? 'unmapped';
    const key = item.curated_asset_key?.trim() || null;
    const slot = richGarmentSlot(item);
    const issues: ClothingMigrationIssue[] = [];
    if (!key) issues.push('missing-stable-key');
    else if ((keys.get(key) ?? 0) > 1) issues.push('duplicate-stable-key');
    if (!item.collection_id || !collectionNames.has(item.collection_id)) issues.push('unassigned-pack');
    if (!config) issues.push('missing-v2-mapping');

    // Every garment must have its corresponding four LODs for BOTH frames
    // before it can replace existing V1 clothing in all camera distances.
    // Headwear/eyewear/accessories still need fitted mesh proofs per frame.
    if (config) {
      if (!config.frames.masculine || !config.frames.feminine ||
          !config.frames.masculine.lod0 || !config.frames.feminine.lod0) {
        issues.push('incomplete-v2-frames');
      }
      if (['masculine', 'feminine'].some(frame =>
        ALL_LODS.some(lod => !config.frames[frame as 'masculine' | 'feminine']?.[lod])
      )) issues.push('missing-v2-lods');
      if (['top', 'bottom', 'footwear'].includes(slot) && !config.occludeBodyRegions.length) {
        issues.push('missing-body-occlusion');
      }
      if (config.colourMode === 'zones' && !config.materialZones.main.length) {
        issues.push('missing-colour-zones');
      }
    }
    if (status === 'published' && item.preview_status !== 'ready') {
      issues.push('preview-metadata-pending');
    }
    if (status === 'blocked') issues.push('blocked-item');
    if (status === 'legacy') issues.push('legacy-review');

    const v2MappingComplete = !!config && config.status === 'validated' &&
      !issues.some(issue => ['incomplete-v2-frames', 'missing-v2-lods',
        'missing-body-occlusion', 'missing-colour-zones'].includes(issue));
    const wave: ClothingMigrationWave =
      status === 'published' ? '1-published' :
      status === 'blocked' ? '2-blocked' :
      status === 'legacy' ? '3-legacy' : '4-unreleased';

    return {
      id: item.id, name: item.name, key,
      collectionId: item.collection_id,
      collectionName: item.collection_id
        ? collectionNames.get(item.collection_id) ?? 'Missing collection'
        : 'Unassigned / legacy',
      slot, curatedStatus: status,
      v2Status, previewStatus: item.preview_status ?? 'unknown',
      hasBonuses: item.bonus_enabled === true,
      wave, issues, v2MappingComplete,
    };
  }).sort((a, b) => WAVES.indexOf(a.wave) - WAVES.indexOf(b.wave) ||
      Number(b.issues.includes('preview-metadata-pending')) - Number(a.issues.includes('preview-metadata-pending')) ||
      a.collectionName.localeCompare(b.collectionName) || a.name.localeCompare(b.name));

  const inStatus = (status: string) => rows.filter(row => row.curatedStatus === status).length;
  return {
    total: rows.length,
    published: inStatus('published'),
    legacy: inStatus('legacy'),
    blocked: inStatus('blocked'),
    unassigned: rows.filter(row => row.issues.includes('unassigned-pack')).length,
    v2Mapped: rows.filter(row => row.v2Status !== 'unmapped').length,
    v2MappingComplete: rows.filter(row => row.v2MappingComplete).length,
    publishedMissingV2: rows.filter(row => row.curatedStatus === 'published' &&
      !row.v2MappingComplete).length,
    publishedPendingPreviews: rows.filter(row =>
      row.issues.includes('preview-metadata-pending')).length,
    existingBonuses: rows.filter(row => row.hasBonuses).length,
    byCollection: collections.map(collection => {
      const inCollection = rows.filter(row => row.collectionId === collection.id);
      return {
        id: collection.id,
        name: collection.name,
        total: inCollection.length,
        published: inCollection.filter(row => row.curatedStatus === 'published').length,
        blocked: inCollection.filter(row => row.curatedStatus === 'blocked').length,
        legacy: inCollection.filter(row => row.curatedStatus === 'legacy').length,
        v2Mapped: inCollection.filter(row => row.v2Status !== 'unmapped').length,
        v2MappingComplete: inCollection.filter(row => row.v2MappingComplete).length,
      };
    }),
    rows,
  };
}
