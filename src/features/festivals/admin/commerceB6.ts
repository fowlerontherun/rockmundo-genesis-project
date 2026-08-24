import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FestivalPricingRule = {
  id: string;
  name: string;
  fromBps: number;
  toBps: number;
  adjustmentBps: number;
  minPriceMinor: number;
  maxPriceMinor: number;
  priority: number;
  active: boolean;
  version: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type FestivalTicketCommerceProduct = {
  id: string;
  name: string;
  productClass: string;
  ticketType: string;
  basePriceMinor: number;
  effectivePriceMinor: number;
  pricingVersion: number;
  capacity: number;
  sold: number;
  remaining: number;
  rules: FestivalPricingRule[];
};

export type FestivalVendorStall = {
  id: string;
  stallName: string;
  category: string;
  vendorName: string;
  vendorOwnerType: "player" | "band" | "company";
  vendorOwnerId: string;
  revenueShareBasisPoints: number;
  shareBase: "gross" | "gross_after_tax";
  currencyCode: string;
  active: boolean;
  version: number;
};

export type FestivalVendorRuntimeSale = {
  id: string;
  runtimeDayId: string;
  category: string;
  productName: string;
  currencyCode: string;
  openingStock: number;
  remainingStock: number;
  unitsSold: number;
  grossRevenueMinor: number;
  taxLiabilityMinor: number;
  costBasisMinor: number;
  status: "open" | "closed";
  version: number;
  vendorStallAssignmentId: string | null;
};

export type FestivalCommerceAnalytics = {
  editionId: string;
  festivalId?: string;
  linked: boolean;
  festivalLaunchId?: string;
  festivalCompanyId?: string;
  bridgeProvenance?: string;
  runtimeSessionId?: string | null;
  asOf?: string;
  tickets?: {
    currencyCode: string;
    capacity: number;
    reserved: number;
    sold: number;
    remaining: number;
    sellThroughBasisPoints: number;
    subtotalMinor: number;
    feeMinor: number;
    taxMinor: number;
    collectedMinor: number;
    refundsMinor: number;
    netCashMinor: number;
    financePostedMinor: number;
    products: FestivalTicketCommerceProduct[];
  };
  vendors?: {
    grossMinor: number;
    taxMinor: number;
    costBasisMinor: number;
    postedMinor: number;
    sharePayableMinor: number;
    sharePaidMinor: number;
    shareOutstandingMinor: number;
    stalls: FestivalVendorStall[];
    sales: FestivalVendorRuntimeSale[];
  };
  attendance?: { uniqueAttendees: number; totalAdmissions: number; peakOnsite: number };
  satisfaction?: { averageScore: number | null };
  performance?: { completedPerformances: number; averageScore: number | null; peakAudience: number };
  settlement?: {
    id: string;
    status: string;
    currencyCode: string;
    totalRevenueMinor: number;
    totalCostMinor: number;
    netProfitLossMinor: number;
    cashReceivedMinor: number;
    cashPaidMinor: number;
    outstandingPayablesMinor: number;
    outstandingReceivablesMinor: number;
  } | null;
  reconciliation: {
    balanced: boolean;
    codes: string[];
    ticketSalesMinor?: number;
    ticketFinanceMinor?: number;
    vendorSalesMinor?: number;
    vendorPostingsMinor?: number;
    vendorSharePayableMinor?: number;
    vendorSharePaidMinor?: number;
  };
};

type RpcError = { message?: string; code?: string; details?: string };

type PublicTicketProduct = { currency?: string | null };
type RuntimeVendorSaleRow = {
  id: string;
  runtime_day_id: string;
  category: string;
  product_name: string;
  currency_code: string;
  opening_stock: number;
  remaining_stock: number;
  units_sold: number;
  gross_revenue_minor: number;
  tax_liability_minor: number;
  cost_basis_minor: number;
  status: "open" | "closed";
  version: number;
  vendor_stall_assignment_id?: string | null;
};

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) {
    const e = error as RpcError;
    throw new Error(`${name}: ${e.message ?? e.code ?? "Festival commerce request failed"}`);
  }
  return data as T;
}

const mapRuntimeVendorSale = (row: RuntimeVendorSaleRow): FestivalVendorRuntimeSale => ({
  id: row.id,
  runtimeDayId: row.runtime_day_id,
  category: row.category,
  productName: row.product_name,
  currencyCode: row.currency_code,
  openingStock: Number(row.opening_stock ?? 0),
  remainingStock: Number(row.remaining_stock ?? 0),
  unitsSold: Number(row.units_sold ?? 0),
  grossRevenueMinor: Number(row.gross_revenue_minor ?? 0),
  taxLiabilityMinor: Number(row.tax_liability_minor ?? 0),
  costBasisMinor: Number(row.cost_basis_minor ?? 0),
  status: row.status,
  version: Number(row.version ?? 1),
  vendorStallAssignmentId: row.vendor_stall_assignment_id ?? null,
});

export async function fetchFestivalCommerceAnalytics(editionId: string) {
  const analytics = await rpc<FestivalCommerceAnalytics>("get_festival_edition_commerce_analytics", {
    p_edition_id: editionId,
  });
  if (!analytics.linked || !analytics.festivalLaunchId) return analytics;

  const [publicProducts, runtimeSales] = await Promise.all([
    rpc<PublicTicketProduct[]>("get_public_festival_ticket_products", {
      p_festival_launch_id: analytics.festivalLaunchId,
    }),
    analytics.runtimeSessionId
      ? rpc<RuntimeVendorSaleRow[]>("get_festival_vendor_sales", {
          p_runtime_session_id: analytics.runtimeSessionId,
        })
      : Promise.resolve([]),
  ]);
  const sales = (runtimeSales ?? []).map(mapRuntimeVendorSale);
  const currencyCode =
    publicProducts?.find((product) => product.currency)?.currency ??
    sales[0]?.currencyCode ??
    analytics.settlement?.currencyCode ??
    analytics.vendors?.stalls[0]?.currencyCode ??
    "USD";

  return {
    ...analytics,
    tickets: analytics.tickets
      ? { ...analytics.tickets, currencyCode }
      : analytics.tickets,
    vendors: analytics.vendors
      ? { ...analytics.vendors, sales }
      : analytics.vendors,
  };
}

export type PricingRuleInput = {
  festivalLaunchId: string;
  ticketProductId: string;
  ruleName: string;
  minSellThroughBasisPoints: number;
  maxSellThroughBasisPoints: number;
  adjustmentBasisPoints: number;
  minPriceMinor: number;
  maxPriceMinor: number;
  startsAt?: string | null;
  endsAt?: string | null;
  priority: number;
  active: boolean;
  expectedVersion: number;
  idempotencyKey: string;
};

export function saveFestivalTicketPricingRule(input: PricingRuleInput) {
  return rpc<{ rule: Record<string, unknown>; pricing: Record<string, unknown> }>(
    "save_festival_ticket_dynamic_pricing_rule",
    {
      p_festival_launch_id: input.festivalLaunchId,
      p_ticket_product_id: input.ticketProductId,
      p_rule_name: input.ruleName,
      p_min_sell_through_basis_points: input.minSellThroughBasisPoints,
      p_max_sell_through_basis_points: input.maxSellThroughBasisPoints,
      p_adjustment_basis_points: input.adjustmentBasisPoints,
      p_min_price_minor: input.minPriceMinor,
      p_max_price_minor: input.maxPriceMinor,
      p_starts_at: input.startsAt ?? null,
      p_ends_at: input.endsAt ?? null,
      p_priority: input.priority,
      p_active: input.active,
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
    },
  );
}

export type VendorAssignmentInput = {
  festivalLaunchId: string;
  stallName: string;
  category: "food" | "soft_drinks" | "alcohol_where_game_rules_allow" | "festival_merch";
  vendorName: string;
  vendorOwnerType: "player" | "band" | "company";
  vendorOwnerId: string;
  revenueShareBasisPoints: number;
  shareBase: "gross" | "gross_after_tax";
  expectedVersion: number;
  idempotencyKey: string;
};

export function saveFestivalVendorAssignment(input: VendorAssignmentInput) {
  return rpc<{ assignment: Record<string, unknown> }>("save_festival_vendor_stall_assignment", {
    p_festival_launch_id: input.festivalLaunchId,
    p_stall_name: input.stallName,
    p_category: input.category,
    p_vendor_name: input.vendorName,
    p_vendor_owner_type: input.vendorOwnerType,
    p_vendor_owner_id: input.vendorOwnerId,
    p_revenue_share_basis_points: input.revenueShareBasisPoints,
    p_share_base: input.shareBase,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
  });
}

export function assignFestivalRuntimeVendorSale(input: {
  vendorSalesId: string;
  vendorStallAssignmentId: string;
  expectedVersion: number;
  idempotencyKey: string;
}) {
  return rpc<Record<string, unknown>>("assign_festival_runtime_vendor_sale", {
    p_vendor_sales_id: input.vendorSalesId,
    p_vendor_stall_assignment_id: input.vendorStallAssignmentId,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
  });
}

const analyticsKey = (editionId: string) => ["festivals", "commerce-b6", editionId] as const;

export function useFestivalCommerceAnalytics(editionId?: string) {
  return useQuery({
    queryKey: analyticsKey(editionId ?? "missing"),
    queryFn: () => fetchFestivalCommerceAnalytics(editionId as string),
    enabled: Boolean(editionId),
    refetchInterval: 60_000,
  });
}

export function useSaveFestivalTicketPricingRule(editionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveFestivalTicketPricingRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: analyticsKey(editionId) }),
  });
}

export function useSaveFestivalVendorAssignment(editionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveFestivalVendorAssignment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: analyticsKey(editionId) }),
  });
}

export function useAssignFestivalRuntimeVendorSale(editionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignFestivalRuntimeVendorSale,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: analyticsKey(editionId) }),
  });
}
