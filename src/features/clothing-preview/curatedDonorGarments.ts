import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ResolvedEquippedClothing } from './equippedClothing';
import { modelFile, type PlayerAppearance, type Style } from '@/features/player-model/appearance';
import { richGarmentSlot } from './richGarmentVisuals';

export type CuratedDonorPart = 'body' | 'legs' | 'feet';

export interface CuratedDonorSource {
  kind: 'avatar-part';
  assetKey?: string;
  style: Style;
  part: CuratedDonorPart;
  color?: string;
  secondaryColor?: string;
  fabric?: 'plain' | 'stripe' | 'plaid' | 'pinstripe' | 'denim' | 'canvas' | 'two-tone' | 'patent';
  finish?: 'cotton' | 'vintage-cotton' | 'denim' | 'tartan' | 'leather' | 'canvas' | 'polished-leather';
}

export function curatedDonorSource(item: ClothingItem): CuratedDonorSource | null {
  const raw = item.render_config?.curatedSource;
  if (!raw || raw.kind !== 'avatar-part') return null;
  if (!['casual', 'punk', 'suit'].includes(String(raw.style))) return null;
  if (!['body', 'legs', 'feet'].includes(String(raw.part))) return null;
  const material = item.material_config || {};
  const finish = String(raw.finish || material.finish || '').toLowerCase();
  const allowedFinishes = new Set(['cotton','vintage-cotton','denim','tartan','leather','canvas','polished-leather']);
  return {
    kind: 'avatar-part',
    assetKey: item.curated_asset_key || undefined,
    style: raw.style as Style,
    part: raw.part as CuratedDonorPart,
    color: typeof raw.color === 'string' ? raw.color : undefined,
    secondaryColor: typeof raw.secondaryColor === 'string' ? raw.secondaryColor : undefined,
    fabric: typeof raw.fabric === 'string' ? raw.fabric as CuratedDonorSource['fabric'] : undefined,
    finish: allowedFinishes.has(finish) ? finish as CuratedDonorSource['finish'] : undefined,
  };
}

export function curatedDonorForSlot(
  richClothing: ResolvedEquippedClothing[],
  slot: 'top' | 'bottom' | 'footwear',
) {
  const expectedPart: CuratedDonorPart = slot === 'top' ? 'body' : slot === 'bottom' ? 'legs' : 'feet';
  const row = [...richClothing].reverse().find(entry => {
    if (richGarmentSlot(entry.item) !== slot) return false;
    const source = curatedDonorSource(entry.item);
    return source?.part === expectedPart;
  });
  if (!row) return null;
  const source = curatedDonorSource(row.item);
  if (!source) return null;
  const allowedFabrics = new Set(['plain','stripe','plaid','pinstripe','denim','canvas','two-tone','patent']);
  const variantFabric = row.variant?.material && allowedFabrics.has(row.variant.material)
    ? row.variant.material as CuratedDonorSource['fabric']
    : undefined;
  return {
    row,
    source: {
      ...source,
      color: row.variant?.color || source.color,
      secondaryColor: row.variant?.secondaryColor || source.secondaryColor,
      fabric: variantFabric || source.fabric,
    },
  };
}


export function requiredCuratedDonorModelFiles(
  richClothing: ResolvedEquippedClothing[],
  frame: PlayerAppearance['body']['frame'],
) {
  return [...new Set(richClothing
    .map(entry => curatedDonorSource(entry.item))
    .filter((source): source is CuratedDonorSource => !!source)
    .map(source => modelFile(frame, source.style)))];
}
