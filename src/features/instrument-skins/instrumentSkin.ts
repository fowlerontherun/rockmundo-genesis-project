import type { InstrumentId } from '@/features/gig-demo-3d/instrumentCatalog';

export const INSTRUMENT_DESIGNS = ['solid', 'two_tone', 'sunburst', 'racing_stripes', 'checker', 'flames', 'lightning'] as const;
export type InstrumentDesignKey = typeof INSTRUMENT_DESIGNS[number];

export interface InstrumentSkinZone {
  id: 'body' | 'secondary' | 'pickguard' | 'hardware' | string;
  name: string;
  color?: string;
  playerEditable?: boolean;
  player_editable?: boolean;
}

export interface InstrumentSkinVariant {
  id?: string;
  key?: string;
  name?: string;
  label?: string;
  designKey?: InstrumentDesignKey;
  design_key?: InstrumentDesignKey;
  bodyColor?: string;
  body_color?: string;
  secondaryColor?: string;
  secondary_color?: string;
  pickguardColor?: string;
  pickguard_color?: string;
  hardwareColor?: string;
  hardware_color?: string;
}

export interface InstrumentSkinItem {
  id: string;
  external_key?: string | null;
  name: string;
  description?: string | null;
  target_instrument: InstrumentId;
  price: number | null;
  rarity?: string | null;
  is_premium?: boolean | null;
  is_limited_edition?: boolean | null;
  featured?: boolean | null;
  is_active?: boolean | null;
  collection_id?: string | null;
  release_date?: string | null;
  expiry_date?: string | null;
  design_key: InstrumentDesignKey;
  body_color: string;
  secondary_color: string;
  pickguard_color: string;
  hardware_color: string;
  color_variants?: string[] | null;
  variant_matrix?: InstrumentSkinVariant[] | null;
  customization_zones?: InstrumentSkinZone[] | null;
}

export interface ResolvedInstrumentSkinVisual {
  itemId: string;
  instrumentId: InstrumentId;
  designKey: InstrumentDesignKey;
  bodyColor: string;
  secondaryColor: string;
  pickguardColor: string;
  hardwareColor: string;
}

export interface EquippedInstrumentSkinRow {
  profile_id: string;
  item_id: string;
  instrument_id: InstrumentId;
  design_key: InstrumentDesignKey;
  body_color: string;
  secondary_color: string;
  pickguard_color: string;
  hardware_color: string;
  variant_matrix?: InstrumentSkinVariant[] | null;
  customization_zones?: InstrumentSkinZone[] | null;
  selected_variant_key?: string | null;
  customization_config?: Record<string, string> | null;
}

const HEX = /^#[0-9a-f]{6}$/i;
const colour = (value: unknown, fallback: string) => typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback;
const design = (value: unknown, fallback: InstrumentDesignKey): InstrumentDesignKey =>
  typeof value === 'string' && (INSTRUMENT_DESIGNS as readonly string[]).includes(value) ? value as InstrumentDesignKey : fallback;

const variantId = (variant: InstrumentSkinVariant, index: number) =>
  variant.id || variant.key || variant.name || variant.label || `variant-${index}`;

export function instrumentSkinVariants(item: InstrumentSkinItem) {
  const named = Array.isArray(item.variant_matrix) ? item.variant_matrix.map((variant, index) => ({
    ...variant,
    id: variantId(variant, index),
    label: variant.label || variant.name || `Style ${index + 1}`,
  })) : [];
  if (named.length) return named;
  const colours = Array.isArray(item.color_variants) ? item.color_variants : [];
  if (colours.length) return colours.map((bodyColor, index) => ({ id: `color-${index}`, label: `Colour ${index + 1}`, bodyColor }));
  return [{ id: 'default', label: 'Default' }];
}

export function editableInstrumentSkinZones(item: InstrumentSkinItem) {
  return (Array.isArray(item.customization_zones) ? item.customization_zones : [])
    .filter(zone => zone?.playerEditable === true || zone?.player_editable === true);
}

export function sanitizeInstrumentZoneColours(item: InstrumentSkinItem, input?: Record<string, string> | null) {
  const allowed = new Set(editableInstrumentSkinZones(item).map(zone => String(zone.id)));
  return Object.fromEntries(Object.entries(input || {})
    .filter(([key, value]) => allowed.has(key) && HEX.test(value))
    .map(([key, value]) => [key, value.toLowerCase()]));
}

export function resolveInstrumentSkinVisual(
  item: InstrumentSkinItem,
  selectedVariantKey?: string | null,
  customization?: Record<string, string> | null,
): ResolvedInstrumentSkinVisual {
  const variants = instrumentSkinVariants(item);
  const variant = variants.find(candidate => candidate.id === selectedVariantKey) || variants[0] || {};
  const zones = sanitizeInstrumentZoneColours(item, customization);

  return {
    itemId: item.id,
    instrumentId: item.target_instrument,
    designKey: design(variant.designKey ?? variant.design_key, item.design_key),
    bodyColor: colour(zones.body ?? variant.bodyColor ?? variant.body_color, colour(item.body_color, '#ab713d')),
    secondaryColor: colour(zones.secondary ?? variant.secondaryColor ?? variant.secondary_color, colour(item.secondary_color, '#f1d7a1')),
    pickguardColor: colour(zones.pickguard ?? variant.pickguardColor ?? variant.pickguard_color, colour(item.pickguard_color, '#15171c')),
    hardwareColor: colour(zones.hardware ?? variant.hardwareColor ?? variant.hardware_color, colour(item.hardware_color, '#bdc2cb')),
  };
}

export function resolveStageInstrumentSkin(row: EquippedInstrumentSkinRow): ResolvedInstrumentSkinVisual {
  return resolveInstrumentSkinVisual({
    id: row.item_id,
    name: row.item_id,
    target_instrument: row.instrument_id,
    price: 0,
    design_key: row.design_key,
    body_color: row.body_color,
    secondary_color: row.secondary_color,
    pickguard_color: row.pickguard_color,
    hardware_color: row.hardware_color,
    variant_matrix: row.variant_matrix,
    customization_zones: row.customization_zones,
  }, row.selected_variant_key, row.customization_config);
}
