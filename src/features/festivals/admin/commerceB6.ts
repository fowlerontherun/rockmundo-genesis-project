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

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) {
    const e = error as RpcError;
    throw new Error(`${name}: ${e.message ?? e.code ?? "Festival commerce request failed"}`);
  }
  return data as T;
}

export function fetchFestivalCommerceAnalytics(editionId: string) {
  return rpc<FestivalCommerceAnalytics>("get_festival_edition_commerce_analytics", {
    p_edition_id: editionId,
  });
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
