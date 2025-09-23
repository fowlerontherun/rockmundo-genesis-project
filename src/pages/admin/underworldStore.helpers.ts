import { z } from "zod";

import type { Database } from "@/lib/supabase-types";

export const UNDERWORLD_ITEM_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const;

export const UNDERWORLD_ITEM_AVAILABILITIES = [
  "in_stock",
  "limited",
  "restocking",
  "special_order",
] as const;

export type UnderworldItemRarity = (typeof UNDERWORLD_ITEM_RARITIES)[number];
export type UnderworldItemAvailability = (typeof UNDERWORLD_ITEM_AVAILABILITIES)[number];

export const UNDERWORLD_RARITY_LABELS: Record<UnderworldItemRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export const UNDERWORLD_RARITY_BADGE_STYLES: Record<UnderworldItemRarity, string> = {
  common: "border-muted text-muted-foreground",
  uncommon: "border-emerald-500/40 text-emerald-500",
  rare: "border-sky-500/40 text-sky-500",
  epic: "border-fuchsia-500/40 text-fuchsia-500",
  legendary: "border-amber-500/40 text-amber-500",
};

export const UNDERWORLD_AVAILABILITY_LABELS: Record<UnderworldItemAvailability, string> = {
  in_stock: "In Stock",
  limited: "Limited",
  restocking: "Restocking",
  special_order: "Special order",
};

export const UNDERWORLD_AVAILABILITY_BADGE_VARIANTS: Record<
  UnderworldItemAvailability,
  "default" | "secondary" | "destructive" | "outline"
> = {
  in_stock: "secondary",
  limited: "default",
  restocking: "outline",
  special_order: "outline",
};

export const DEFAULT_UNDERWORLD_PRICE_CURRENCY = "SCL";

export const underworldStoreItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  rarity: z.enum(UNDERWORLD_ITEM_RARITIES, {
    errorMap: () => ({ message: "Select a rarity" }),
  }),
  priceAmount: z
    .coerce
    .number({ invalid_type_error: "Price must be a number" })
    .min(0, "Price cannot be negative"),
  priceCurrency: z.string().min(1, "Currency is required"),
  availability: z.enum(UNDERWORLD_ITEM_AVAILABILITIES, {
    errorMap: () => ({ message: "Choose availability" }),
  }),
  description: z.string().optional(),
  imageUrl: z.string().url("Provide a valid URL").optional().or(z.literal("")),
  sortOrder: z
    .coerce
    .number({ invalid_type_error: "Sort order must be a number" })
    .min(0, "Sort order cannot be negative"),
  isActive: z.boolean(),
});

export type UnderworldStoreItemFormValues = z.infer<typeof underworldStoreItemSchema>;

export type UnderworldStoreItemsTable = Database["public"]["Tables"] extends {
  underworld_store_items: infer T;
}
  ? T
  : {
      Row: {
        id: string;
        name: string;
        category: string;
        rarity: UnderworldItemRarity;
        price_amount: number | string;
        price_currency: string;
        availability: UnderworldItemAvailability;
        description: string | null;
        image_url: string | null;
        sort_order: number;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        name: string;
        category: string;
        rarity?: UnderworldItemRarity;
        price_amount?: number | string;
        price_currency?: string;
        availability?: UnderworldItemAvailability;
        description?: string | null;
        image_url?: string | null;
        sort_order?: number;
        is_active?: boolean;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        name?: string;
        category?: string;
        rarity?: UnderworldItemRarity;
        price_amount?: number | string;
        price_currency?: string;
        availability?: UnderworldItemAvailability;
        description?: string | null;
        image_url?: string | null;
        sort_order?: number;
        is_active?: boolean;
        created_at?: string;
        updated_at?: string;
      };
    };

export type UnderworldStoreItemRow = UnderworldStoreItemsTable extends { Row: infer R } ? R : never;
export type UnderworldStoreItemInsert = UnderworldStoreItemsTable extends { Insert: infer I } ? I : never;
export type UnderworldStoreItemUpdate = UnderworldStoreItemsTable extends { Update: infer U } ? U : never;

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const parsePriceAmount = (
  value: UnderworldStoreItemRow["price_amount"] | number | string | null | undefined,
): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const formatUnderworldStorePrice = (
  amount: UnderworldStoreItemRow["price_amount"] | number,
  currency: string | null | undefined,
): string => {
  const numericAmount = parsePriceAmount(amount);
  const formattedAmount = priceFormatter.format(numericAmount);
  const normalizedCurrency = currency?.trim();

  return normalizedCurrency ? `${formattedAmount} ${normalizedCurrency}` : formattedAmount;
};

export const mapUnderworldStoreRowToFormValues = (
  item: UnderworldStoreItemRow,
): UnderworldStoreItemFormValues => ({
  name: item.name,
  category: item.category,
  rarity: item.rarity,
  priceAmount: parsePriceAmount(item.price_amount),
  priceCurrency: item.price_currency ?? DEFAULT_UNDERWORLD_PRICE_CURRENCY,
  availability: item.availability ?? "special_order",
  description: item.description ?? "",
  imageUrl: item.image_url ?? "",
  sortOrder: item.sort_order ?? 0,
  isActive: Boolean(item.is_active ?? true),
});

export const UNDERWORLD_STORE_FORM_DEFAULTS: UnderworldStoreItemFormValues = {
  name: "",
  category: "",
  rarity: "common",
  priceAmount: 0,
  priceCurrency: DEFAULT_UNDERWORLD_PRICE_CURRENCY,
  availability: "special_order",
  description: "",
  imageUrl: "",
  sortOrder: 0,
  isActive: true,
};

export const rarityOptions = UNDERWORLD_ITEM_RARITIES.map((rarity) => ({
  value: rarity,
  label: UNDERWORLD_RARITY_LABELS[rarity],
}));

export const availabilityOptions = UNDERWORLD_ITEM_AVAILABILITIES.map((availability) => ({
  value: availability,
  label: UNDERWORLD_AVAILABILITY_LABELS[availability],
}));
