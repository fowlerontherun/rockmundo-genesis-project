export interface GearCategory {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  icon: string | null;
  sort_order: number | null;
}

export interface EquipmentItemRecord {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  price: number;
  price_cash: number | null;
  price_fame: number | null;
  rarity: string | null;
  description: string | null;
  stat_boosts: Record<string, number> | null;
  stock: number | null;
  image_url?: string | null;
  brand?: string | null;
  brand_logo_url?: string | null;
  color_options?: string[] | null;
  skill_boost_slug?: string | null;
  created_at?: string;
}

export const GEAR_BRANDS = [
  "Fender", "Gibson", "PRS", "Ibanez", "Martin", "Taylor", "Epiphone", "Squier",
  "Jackson", "ESP", "Gretsch", "Rickenbacker", "Music Man", "Yamaha", "Schecter",
  "Warwick", "Fodera", "Nord", "Roland", "Korg", "Moog", "Sequential", "Arturia",
  "Casio", "Kawai", "Pearl", "Tama", "Ludwig", "Gretsch", "DW", "Sonor",
  "Zildjian", "Sabian", "Meinl", "Shure", "Neumann", "Sennheiser", "AKG",
  "Audio-Technica", "Rode", "Focusrite", "Universal Audio", "RME", "MOTU",
  "PreSonus", "Behringer", "Apogee", "Pioneer DJ", "Technics", "Numark",
  "Native Instruments", "Rane", "Allen and Heath", "Selmer", "Bach", "Buffet",
  "Conn", "King", "Alexander", "Monette", "Hohner", "Jupiter", "Powell", "Muramatsu"
] as const;

export type GearBrand = typeof GEAR_BRANDS[number];

export const GUITAR_COLORS = [
  "Jet Black", "Arctic White", "Vintage Sunburst", "3-Color Sunburst",
  "Candy Apple Red", "Lake Placid Blue", "Surf Green", "Olympic White",
  "Natural", "Tobacco Sunburst", "Cherry Burst", "Honeyburst",
  "Gold Top", "Silverburst", "Seafoam Green", "Shell Pink",
  "Heritage Cherry", "Ebony", "TV Yellow", "Fiesta Red"
] as const;

export const normalizeColorOptions = (value: unknown): string[] | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return null;
};

export type EquipmentCurrencyCost = {
  cash: number;
  fame: number;
};

export const normalizeEquipmentStatBoosts = (
  value: unknown
): Record<string, number> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entries: Array<[string, number]> = [];

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const numericValue = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);

    if (!Number.isFinite(numericValue)) {
      continue;
    }

    entries.push([key, numericValue]);
  }

  return entries.length > 0 ? Object.fromEntries(entries) : null;
};
