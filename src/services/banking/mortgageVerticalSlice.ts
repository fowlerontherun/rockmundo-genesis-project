import { supabase } from "@/integrations/supabase/client";

export type RpcState<T> = { status: "idle" | "loading" | "success" | "empty" | "error"; data?: T; message?: string };
export type MortgageProperty = { id: string; district_name?: string; city_name?: string; property_type?: string; current_valuation_minor?: number; currency_code?: string; listing_status?: string; condition?: number; prestige?: number; size_sqm?: number };
export type MortgageProduct = { id: string; product_name: string; providerName?: string; annual_rate_bps: number; min_deposit_bps: number; min_term_months?: number; max_term_months?: number };
export type MortgageApplication = { id: string; status: string; currency_code: string };
export type MortgageUnderwritingResult = { status: string; rejection_reasons?: string[]; verified_deposit_minor: number; required_deposit_minor: number; principal_minor: number; ltv_bps: number; stressed_payment_minor: number; disposable_income_minor: number };
export type MortgageOffer = { id: string; application_id: string; provider_id: string; purchase_price_minor: number; deposit_minor: number; principal_minor: number; currency_code: string; annual_rate_bps: number; term_months: number; monthly_payment_minor: number; total_repayment_estimate_minor: number; expires_at: string; status: string };
export type MortgageSummary = { id: string; outstandingPrincipalMinor: number; currencyCode: string; nextPaymentDueDate?: string; status: string };
export type MortgageScheduleLine = { id: string; instalment_number: number; due_date: string; principal_due_minor: number; interest_due_minor: number; fees_due_minor: number; total_due_minor: number; paid_principal_minor: number; paid_interest_minor: number; paid_fees_minor: number; currency_code: string; status: string };
export type MortgageDashboard = { contract?: { id: string; outstanding_principal_minor: number; currency_code: string }; property?: MortgageProperty; equity?: { ltv_bps?: number; equity_minor?: number }; nextScheduleLine?: Partial<MortgageScheduleLine>; security?: { status: string }; arrears?: { stage?: string } };
export type PropertyDetail = { property: MortgageProperty; products: MortgageProduct[] };

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function asArray<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
async function rpcJson<T>(fn: string, args?: Record<string, unknown>, empty?: (value: unknown) => boolean): Promise<RpcState<T>> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) return { status: "error", message: error.message };
  if (data == null || empty?.(data)) return { status: "empty" };
  return { status: "success", data: data as T };
}
export async function loadPropertyDetail(propertyId: string) { return rpcJson<PropertyDetail>("get_property_detail", { p_property_id: propertyId }); }
export async function submitMortgageApplication(input: { propertyId: string; productId: string; termMonths: number; depositMinor: number; currencyCode: string; idempotencyKey: string }) { return rpcJson<string>("create_mortgage_application", { p_property_id: input.propertyId, p_product_id: input.productId, p_term_months: input.termMonths, p_requested_deposit_minor: input.depositMinor, p_currency_code: input.currencyCode, p_idempotency_key: input.idempotencyKey }); }
export async function loadApplication(applicationId: string) { return rpcJson<MortgageApplication>("get_mortgage_application", { p_application_id: applicationId }); }
export async function loadUnderwritingResult(applicationId: string) { return rpcJson<MortgageUnderwritingResult>("get_mortgage_underwriting_result", { p_application_id: applicationId }); }
export async function loadOffer(applicationId: string) { return rpcJson<MortgageOffer>("get_mortgage_offer", { p_application_id: applicationId }); }
export async function reserveOffer(offerId: string, idempotencyKey: string) { return rpcJson<Record<string, unknown>>("reserve_property_for_mortgage_offer", { p_offer_id: offerId, p_idempotency_key: idempotencyKey }); }
export async function listMortgages() { return rpcJson<MortgageSummary[]>("list_my_mortgages", undefined, (value) => asArray<unknown>(value).length === 0); }
export async function loadDashboard(mortgageId: string) { return rpcJson<MortgageDashboard>("get_mortgage_dashboard", { p_mortgage_contract_id: mortgageId }); }
export async function loadSchedule(mortgageId: string) { return rpcJson<MortgageScheduleLine[]>("get_mortgage_schedule", { p_mortgage_contract_id: mortgageId }, (value) => asArray<unknown>(value).length === 0); }
export const normalizePropertyDetail = (state: RpcState<PropertyDetail>) => asRecord(state.data);
