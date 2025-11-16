import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export type MerchInventoryItem = Tables<"player_merchandise">;

export type MerchOrderStatus = "processing" | "fulfilled" | "cancelled";
export type MerchOrderChannel = "online" | "booth" | "vip";

export interface MerchOrder {
  id: string;
  bandId: string;
  merchId: string;
  itemType: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: MerchOrderStatus;
  channel: MerchOrderChannel;
  orderedAt: string;
}

export interface MerchOrderSummary {
  totalRevenue: number;
  totalUnits: number;
  averageOrderValue: number;
  fulfillmentRate: number;
  orderCount: number;
  lastOrderAt: string | null;
  channelVolume: Record<MerchOrderChannel, number>;
}

export interface InventoryHealth {
  totalSkus: number;
  totalUnits: number;
  potentialRevenue: number;
  costBasis: number;
  grossMargin: number;
  lowStock: MerchInventoryItem[];
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orders: number;
  units: number;
}

export interface CategoryPerformancePoint {
  category: string;
  stock: number;
  sold: number;
  revenue: number;
}

const ORDER_CHANNELS: MerchOrderChannel[] = ["online", "booth", "vip"];
const ORDER_STATUSES: MerchOrderStatus[] = ["processing", "fulfilled", "cancelled"];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Apparel: ["tee", "hoodie", "shirt", "crewneck", "jacket"],
  Accessories: ["cap", "hat", "bag", "lanyard", "pin"],
  Collectibles: ["poster", "print", "vinyl", "zine", "art"],
  Digital: ["digital", "download", "code", "qr"],
  Experiences: ["experience", "vip", "backstage", "hang"],
};

const normalize = (value: string | null | undefined) => value?.toLowerCase() ?? "";

const resolveCategory = (itemType: string): string => {
  const normalized = normalize(itemType);

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  return "Special Edition";
};

const seededRandom = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
  }

  return () => {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    return (Math.abs(h) % 10000) / 10000;
  };
};

const defaultInventoryStub: MerchInventoryItem = {
  id: "stub",
  band_id: "stub",
  design_name: "Limited Drop",
  item_type: "Custom Tee",
  cost_to_produce: 11,
  selling_price: 32,
  stock_quantity: 64,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  custom_design_id: null,
  sales_boost_pct: 0,
};

const generateOrderId = (bandId: string, index: number) => `${bandId}-${index}`;

const deriveUnitPrice = (item?: MerchInventoryItem | null) => {
  if (!item) {
    return 28;
  }

  if (typeof item.selling_price === "number") {
    return item.selling_price;
  }

  return Math.round((item.cost_to_produce ?? 0) * 1.8) || 24;
};

const generateSyntheticOrders = (
  bandId: string,
  inventory: MerchInventoryItem[],
): MerchOrder[] => {
  const items = inventory.length ? inventory : [defaultInventoryStub];
  const random = seededRandom(`${bandId}:${items.length}`);
  const orderCount = Math.max(12, items.length * 6);
  const now = Date.now();

  const orders: MerchOrder[] = [];

  for (let index = 0; index < orderCount; index += 1) {
    const item = items[Math.floor(random() * items.length)] ?? defaultInventoryStub;
    const quantity = Math.max(1, Math.round(random() * 5));
    const unitPrice = deriveUnitPrice(item);
    const channel = ORDER_CHANNELS[Math.floor(random() * ORDER_CHANNELS.length)];
    const statusWeights: Record<MerchOrderStatus, number> = {
      fulfilled: 0.62,
      processing: 0.25,
      cancelled: 0.13,
    };

    const statusRoll = random();
    let cumulative = 0;
    let status: MerchOrderStatus = "fulfilled";

    for (const candidate of ORDER_STATUSES) {
      cumulative += statusWeights[candidate];
      if (statusRoll <= cumulative) {
        status = candidate;
        break;
      }
    }

    const leadDays = Math.floor(random() * 56);
    const orderedAt = new Date(now - leadDays * 24 * 60 * 60 * 1000 - index * 2 * 60 * 60 * 1000);
    const total = Math.round(unitPrice * quantity * (0.85 + random() * 0.35) * 100) / 100;

    orders.push({
      id: generateOrderId(bandId, index),
      bandId,
      merchId: item.id,
      itemType: item.item_type,
      quantity,
      unitPrice,
      total,
      status,
      channel,
      orderedAt: orderedAt.toISOString(),
    });
  }

  return orders.sort(
    (a, b) => new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime(),
  );
};

export const fetchMerchInventory = async (
  bandId: string,
): Promise<MerchInventoryItem[]> => {
  const { data, error } = await supabase
    .from("player_merchandise")
    .select("*")
    .eq("band_id", bandId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as MerchInventoryItem[] | null) ?? [];
};

export const fetchMerchOrders = async (
  bandId: string,
  inventory?: MerchInventoryItem[],
): Promise<MerchOrder[]> => {
  const sourceInventory = inventory ?? (await fetchMerchInventory(bandId));
  return generateSyntheticOrders(bandId, sourceInventory);
};

export const summarizeMerchOrders = (orders: MerchOrder[]): MerchOrderSummary => {
  if (!orders.length) {
    return {
      totalRevenue: 0,
      totalUnits: 0,
      averageOrderValue: 0,
      fulfillmentRate: 0,
      orderCount: 0,
      lastOrderAt: null,
      channelVolume: {
        online: 0,
        booth: 0,
        vip: 0,
      },
    };
  }

  const totals = orders.reduce(
    (acc, order) => {
      const effectiveTotal = order.status === "cancelled" ? 0 : order.total;
      const effectiveUnits = order.status === "cancelled" ? 0 : order.quantity;

      return {
        revenue: acc.revenue + effectiveTotal,
        units: acc.units + effectiveUnits,
        fulfilled: acc.fulfilled + (order.status === "fulfilled" ? 1 : 0),
        volume: {
          ...acc.volume,
          [order.channel]: (acc.volume[order.channel] ?? 0) + 1,
        },
      };
    },
    {
      revenue: 0,
      units: 0,
      fulfilled: 0,
      volume: {
        online: 0,
        booth: 0,
        vip: 0,
      } as Record<MerchOrderChannel, number>,
    },
  );

  const orderCount = orders.length;

  return {
    totalRevenue: totals.revenue,
    totalUnits: totals.units,
    averageOrderValue: orderCount ? totals.revenue / orderCount : 0,
    fulfillmentRate: orderCount ? totals.fulfilled / orderCount : 0,
    orderCount,
    lastOrderAt: orders[orders.length - 1]?.orderedAt ?? null,
    channelVolume: totals.volume,
  };
};

export const computeInventoryHealth = (
  inventory: MerchInventoryItem[],
): InventoryHealth => {
  if (!inventory.length) {
    return {
      totalSkus: 0,
      totalUnits: 0,
      potentialRevenue: 0,
      costBasis: 0,
      grossMargin: 0,
      lowStock: [],
    };
  }

  const metrics = inventory.reduce(
    (acc, item) => {
      const stock = item.stock_quantity ?? 0;
      const price = item.selling_price ?? deriveUnitPrice(item);
      const cost = item.cost_to_produce ?? Math.round(price * 0.45);

      return {
        skus: acc.skus + 1,
        units: acc.units + stock,
        revenue: acc.revenue + stock * price,
        cost: acc.cost + stock * cost,
      };
    },
    { skus: 0, units: 0, revenue: 0, cost: 0 },
  );

  const grossMargin = metrics.revenue ? (metrics.revenue - metrics.cost) / metrics.revenue : 0;
  const lowStock = inventory.filter((item) => (item.stock_quantity ?? 0) < 20);

  return {
    totalSkus: metrics.skus,
    totalUnits: metrics.units,
    potentialRevenue: metrics.revenue,
    costBasis: metrics.cost,
    grossMargin,
    lowStock,
  };
};

export const buildSalesTrendSeries = (
  orders: MerchOrder[],
): SalesTrendPoint[] => {
  if (!orders.length) {
    return [];
  }

  const map = new Map<string, SalesTrendPoint>();

  for (const order of orders) {
    const key = order.orderedAt.slice(0, 10);
    const existing = map.get(key) ?? {
      date: key,
      revenue: 0,
      orders: 0,
      units: 0,
    };

    map.set(key, {
      date: key,
      revenue: existing.revenue + (order.status === "cancelled" ? 0 : order.total),
      orders: existing.orders + 1,
      units: existing.units + (order.status === "cancelled" ? 0 : order.quantity),
    });
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
};

export const buildCategoryPerformance = (
  inventory: MerchInventoryItem[],
  orders: MerchOrder[],
): CategoryPerformancePoint[] => {
  if (!inventory.length && !orders.length) {
    return [];
  }

  const categoryMap = new Map<string, CategoryPerformancePoint>();

  for (const item of inventory) {
    const category = resolveCategory(item.item_type);
    const entry = categoryMap.get(category) ?? {
      category,
      stock: 0,
      sold: 0,
      revenue: 0,
    };

    entry.stock += item.stock_quantity ?? 0;
    categoryMap.set(category, entry);
  }

  for (const order of orders) {
    const category = resolveCategory(order.itemType);
    const entry = categoryMap.get(category) ?? {
      category,
      stock: 0,
      sold: 0,
      revenue: 0,
    };

    entry.sold += order.status === "cancelled" ? 0 : order.quantity;
    entry.revenue += order.status === "cancelled" ? 0 : order.total;
    categoryMap.set(category, entry);
  }

  return Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);
};

export const formatMerchCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
};

export const formatMerchPercent = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
};
