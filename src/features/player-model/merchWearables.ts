export type MerchWearableKind = 'tee' | 'hoodie' | 'long_sleeve' | 'crewneck';

export interface MerchWearableDesign {
  id: string;
  band_id: string;
  design_name: string;
  product_type: string;
  artwork_url?: string | null;
  background_color?: string | null;
  design_data?: Record<string, unknown> | null;
}

const KIND_BY_PRODUCT: Record<string, MerchWearableKind> = {
  'basic tee': 'tee',
  'graphic tee': 'tee',
  'heavyweight tee': 'tee',
  'football shirt': 'tee',
  'long sleeve tee': 'long_sleeve',
  'premium hoodie': 'hoodie',
  'zip hoodie': 'hoodie',
  'tour crewneck': 'crewneck',
};

export function merchWearableKind(productType: string | null | undefined): MerchWearableKind | null {
  return KIND_BY_PRODUCT[String(productType ?? '').trim().toLowerCase()] ?? null;
}

export function merchWearableDonorItem(productType: string | null | undefined): string | null {
  const kind = merchWearableKind(productType);
  if (kind === 'hoodie') return 'starter.top.hoodie';
  if (kind === 'long_sleeve' || kind === 'crewneck') return 'starter.top.long-sleeve';
  if (kind === 'tee') return 'starter.top.casual';
  return null;
}

export function merchGarmentColor(design: Pick<MerchWearableDesign, 'background_color' | 'design_data'>): string {
  const value = design.design_data?.garmentColor ?? design.background_color;
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '#171717';
}

export function crowdMerchChance(input: { fanLoyalty?: number; bandFame?: number; merchPopularity?: number; onSale?: boolean }): number {
  const loyalty = Math.max(0, Math.min(100, input.fanLoyalty ?? 0)) / 100;
  const fame = Math.max(0, Math.min(100, input.bandFame ?? 0)) / 100;
  const popularity = Math.max(0, Math.min(100, input.merchPopularity ?? 0)) / 100;
  const saleBoost = input.onSale ? .08 : 0;
  return Math.max(.02, Math.min(.72, .04 + loyalty * .28 + fame * .12 + popularity * .20 + saleBoost));
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0) / 4294967296;
}

export function fanWearsBandMerch(seed: string, fanIndex: number, chance: number): boolean {
  const safeChance = Math.max(0, Math.min(1, chance));
  return hash(`${seed}:merch:${fanIndex}`) < safeChance;
}


export interface ResolvedMerchWearable {
  profile_id?: string;
  design_id: string;
  band_id: string;
  design_name: string;
  product_type: string;
  artwork_url?: string | null;
  garment_color: string;
  design_data?: Record<string, unknown> | null;
}
