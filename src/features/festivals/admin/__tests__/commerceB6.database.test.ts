import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const launch = readFileSync(
  "supabase/migrations/20291217190000_festival_launch_and_ticket_sales.sql",
  "utf8",
);
const settlement = readFileSync(
  "supabase/migrations/20291217220000_festival_financial_settlement.sql",
  "utf8",
);
const b6 = readFileSync(
  "supabase/migrations/20291219050000_festival_ticket_vendor_analytics_closure.sql",
  "utf8",
);
const verifier = readFileSync("scripts/supabase/verify-migration-timestamps.mjs", "utf8");
const client = readFileSync("src/features/festivals/admin/commerceB6.ts", "utf8");
const commerceUi = readFileSync(
  "src/features/festivals/admin/components/FestivalCommerceAnalytics.tsx",
  "utf8",
);
const runtimeVendorUi = readFileSync(
  "src/features/festivals/admin/components/FestivalRuntimeVendorAssignments.tsx",
  "utf8",
);
const outcomesUi = readFileSync(
  "src/features/festivals/admin/components/FestivalOutcomesManagement.tsx",
  "utf8",
);

describe("festival ticket, vendor and analytics B6 database contract", () => {
  it("keeps admission inventory non-oversellable while pricing stays server-owned", () => {
    expect(launch).toContain(
      "SELECT * INTO i FROM public.festival_ticket_inventory WHERE ticket_product_id=p.id FOR UPDATE",
    );
    expect(launch).toContain("i.available_quantity<p_quantity");
    expect(launch).toContain("festival_ticket_sold_out");
    expect(launch).toContain(
      "purchase_festival_tickets(p_festival_launch_id uuid,p_ticket_product_id uuid,p_quantity integer,p_idempotency_key uuid)",
    );
    expect(b6).toContain("CREATE TABLE IF NOT EXISTS public.festival_ticket_dynamic_pricing_rules");
    expect(b6).toContain("CREATE OR REPLACE FUNCTION public._festival_reprice_ticket_product");
    expect(b6).toContain("AFTER INSERT ON public.festival_ticket_purchase_requests");
    expect(b6).toContain("AFTER UPDATE OF sold_quantity,cancelled_quantity,refunded_quantity,capacity,reserved_quantity");
    expect(b6).toContain("product.base_price_minor::numeric*(10000+rule.adjustment_basis_points)/10000");
  });

  it("versions organiser pricing and vendor configuration with replay-safe commands", () => {
    expect(b6).toContain("CREATE TABLE IF NOT EXISTS public.festival_commerce_requests");
    expect(b6).toContain("UNIQUE(actor_profile_id,action,idempotency_key)");
    expect(b6).toContain("festival_commerce_idempotency_conflict");
    expect(b6).toContain("festival_dynamic_pricing_stale");
    expect(b6).toContain("festival_vendor_assignment_stale");
    expect(b6).toContain("version=version+1,updated_at=now()");
  });

  it("turns configured vendor stalls into immutable close-time share obligations", () => {
    expect(b6).toContain("CREATE TABLE IF NOT EXISTS public.festival_vendor_stall_assignments");
    expect(b6).toContain("CREATE OR REPLACE FUNCTION public.assign_festival_runtime_vendor_sale");
    expect(b6).toContain("sale.status<>'open'");
    expect(b6).toContain("festival_vendor_assignment_closed");
    expect(b6).toContain("CREATE TABLE IF NOT EXISTS public.festival_vendor_settlement_obligations");
    expect(b6).toContain("festival_vendor_settlement_obligation_on_close");
    expect(b6).toContain("'assignmentVersion',assignment.version");
    expect(b6).toContain("'vendorSaleVersion',NEW.version");
  });

  it("routes vendor shares through the existing Phase 9 settlement and Finance journal", () => {
    expect(b6).toContain("'other_expense','festival_vendor_share'");
    expect(b6).toContain("festival_sync_vendor_settlement_lines");
    expect(b6).toContain("festival_sync_vendor_obligation_status");
    expect(b6).toContain("finance_transaction_id=coalesce(tx,finance_transaction_id)");
    expect(settlement).toContain("tx:=public.finance_transfer");
    expect(settlement).toContain("'festival-settlement-line:'||l.id");
    expect(settlement).toContain("line_type IN('inventory_cost','other_expense')");
  });

  it("fails closed when an edition cannot be unambiguously linked to commerce authority", () => {
    expect(b6).toContain("CREATE TABLE IF NOT EXISTS public.festival_edition_commerce_bridges");
    expect(b6).toContain("candidate_count=1");
    expect(b6).toContain("'commerce_bridge_missing'");
    expect(b6).toContain("CREATE OR REPLACE FUNCTION public.admin_link_festival_edition_commerce");
    expect(b6).toContain("festival_commerce_link_reason_required");
  });

  it("reconciles ticket, vendor, attendance, satisfaction and performance evidence", () => {
    expect(b6).toContain("CREATE OR REPLACE FUNCTION public.get_festival_edition_commerce_analytics");
    expect(b6).toContain("tx.related_entity_type='festival_ticket_purchase'");
    expect(b6).toContain("'ticket_finance_mismatch'");
    expect(b6).toContain("'vendor_posting_mismatch'");
    expect(b6).toContain("'vendor_settlement_line_missing'");
    expect(b6).toContain("count(DISTINCT a.issued_ticket_id)");
    expect(b6).toContain("round(avg(c.satisfaction),1)");
    expect(b6).toContain("round(avg(p.performance_score)");
    expect(b6).toContain("'balanced',cardinality(codes)=0");
  });

  it("uses narrow RPC projections in the organiser UI and completes runtime stall assignment", () => {
    expect(client).toContain('"get_festival_edition_commerce_analytics"');
    expect(client).toContain('"get_public_festival_ticket_products"');
    expect(client).toContain('"get_festival_vendor_sales"');
    expect(client).toContain('"assign_festival_runtime_vendor_sale"');
    expect(client).toContain("useAssignFestivalRuntimeVendorSale");
    expect(commerceUi).toContain("data?.tickets?.currencyCode");
    expect(commerceUi).toContain("Ticket tiers & dynamic pricing");
    expect(commerceUi).toContain("Vendor stalls & revenue shares");
    expect(runtimeVendorUi).toContain("Live vendor sale assignments");
    expect(runtimeVendorUi).toContain("Closed sales cannot be retroactively assigned");
    expect(outcomesUi).toContain("FestivalRuntimeVendorAssignments");
  });

  it("keeps new tables private and exposes only permission-checked RPCs", () => {
    expect(b6).toContain("ALTER TABLE public.festival_ticket_dynamic_pricing_rules ENABLE ROW LEVEL SECURITY");
    expect(b6).toContain("ALTER TABLE public.festival_vendor_settlement_obligations ENABLE ROW LEVEL SECURITY");
    expect(b6).toContain("REVOKE ALL ON public.festival_commerce_requests FROM PUBLIC,anon,authenticated");
    expect(b6).toContain("REVOKE ALL ON FUNCTION public._festival_reprice_ticket_product(uuid,text)");
    expect(b6).toContain("GRANT EXECUTE ON FUNCTION public.get_festival_edition_commerce_analytics(uuid) TO authenticated");
    expect(b6).toContain("SECURITY DEFINER SET search_path='' ");
  });

  it("keeps the B6 migration in the explicitly frozen festival continuation sequence", () => {
    expect(verifier).toContain(
      'festivalBacklogB6CommerceContinuation = "20291219050000_festival_ticket_vendor_analytics_closure.sql"',
    );
    expect(verifier).toContain("festivalBacklogB6CommerceContinuation");
  });
});
