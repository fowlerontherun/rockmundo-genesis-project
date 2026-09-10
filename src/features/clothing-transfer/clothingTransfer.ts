import type { ClothingItem } from '@/hooks/useSkinStore';

export const CLOTHING_EXPORT_SCHEMA = 'rockmundo.clothing';
export const CLOTHING_EXPORT_VERSION = 1;

const PORTABLE_FIELDS = [
  'name','description','category','wearable_slot','price','is_premium','rarity','color_variants',
  'release_date','expiry_date','is_limited_edition','featured','rpm_asset_id','bonus_enabled','bonus_config',
  'shape_config','garment_config','material_config','pattern_config','detail_layers','fit_config','wear_config',
  'customization_zones','render_config','variant_matrix','preview_status','preview_manifest',
] as const;

export interface PortableClothingItem {
  schema: typeof CLOTHING_EXPORT_SCHEMA;
  schemaVersion: number;
  externalKey: string;
  originalId?: string;
  collection?: { id?: string; name?: string | null; theme?: string | null } | null;
  item: Record<string, unknown>;
}

export interface PortableClothingBundle {
  schema: 'rockmundo.clothing.bundle';
  schemaVersion: number;
  exportedAt: string;
  collection?: { id?: string; name?: string | null; theme?: string | null } | null;
  items: PortableClothingItem[];
}

export function slugifyExternalKey(name: string, id?: string) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'clothing-item';
  return `rockmundo.${slug}.${(id || crypto.randomUUID()).slice(0, 8)}`;
}

export function toPortableClothingItem(item: ClothingItem | Record<string, any>, collection?: PortableClothingItem['collection']): PortableClothingItem {
  const portable: Record<string, unknown> = {};
  for (const key of PORTABLE_FIELDS) {
    if ((item as any)[key] !== undefined) portable[key] = (item as any)[key];
  }
  return {
    schema: CLOTHING_EXPORT_SCHEMA,
    schemaVersion: CLOTHING_EXPORT_VERSION,
    externalKey: (item as any).external_key || slugifyExternalKey((item as any).name || 'Clothing item', (item as any).id),
    originalId: (item as any).id,
    collection: collection || null,
    item: portable,
  };
}

export function toPortableBundle(items: Array<ClothingItem | Record<string, any>>, collection?: PortableClothingBundle['collection']): PortableClothingBundle {
  return {
    schema: 'rockmundo.clothing.bundle',
    schemaVersion: CLOTHING_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    collection: collection || null,
    items: items.map(item => toPortableClothingItem(item, collection)),
  };
}

export function parsePortableBundle(raw: string): PortableClothingBundle {
  const parsed = JSON.parse(raw);
  if (parsed?.schema === CLOTHING_EXPORT_SCHEMA) {
    return {
      schema: 'rockmundo.clothing.bundle',
      schemaVersion: Number(parsed.schemaVersion || 1),
      exportedAt: new Date().toISOString(),
      collection: parsed.collection || null,
      items: [parsed],
    };
  }
  if (parsed?.schema !== 'rockmundo.clothing.bundle' || !Array.isArray(parsed.items)) {
    throw new Error('This is not a RockMundo clothing export file.');
  }
  if (Number(parsed.schemaVersion || 0) > CLOTHING_EXPORT_VERSION) {
    throw new Error(`This clothing file uses schema v${parsed.schemaVersion}; this build supports v${CLOTHING_EXPORT_VERSION}.`);
  }
  return parsed as PortableClothingBundle;
}

export function validatePortableItem(entry: PortableClothingItem) {
  const errors: string[] = [];
  const item = entry?.item || {};
  if (entry?.schema !== CLOTHING_EXPORT_SCHEMA) errors.push('Invalid item schema');
  if (!String((item as any).name || '').trim()) errors.push('Missing name');
  if (!String((item as any).category || '').trim()) errors.push('Missing category');
  if (!String((item as any).wearable_slot || '').trim()) errors.push('Missing wearable slot');
  if (!entry.externalKey) errors.push('Missing external key');
  if (Array.isArray((item as any).detail_layers) && (item as any).detail_layers.length > 24) errors.push('More than 24 detail layers');
  if (Array.isArray((item as any).customization_zones) && (item as any).customization_zones.length > 12) errors.push('More than 12 customization zones');
  if (Array.isArray((item as any).variant_matrix) && (item as any).variant_matrix.length > 40) errors.push('More than 40 variants');
  return errors;
}

export function browserDownloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
