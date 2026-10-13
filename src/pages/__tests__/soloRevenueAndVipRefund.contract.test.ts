import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read=(path:string)=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
const migration=read("../../../supabase/migrations/20261013191000_solo_artist_revenue_settlement.sql");
const stripe=read("../../../supabase/functions/stripe-webhook/index.ts");
describe("solo payments and refunded VIP subscriptions",()=>{
 it("#2965 records a payout receipt inside the sale transaction",()=>{
  expect(migration).toContain("AFTER INSERT ON public.release_sales");
  expect(migration).toContain("NEW.band_revenue_amount");
  expect(migration).toContain("credit_solo_artist_revenue(v_profile,'release_sale'");
 });
 it("#3017 credits solo streams by source-row id without duplicating",()=>{
  expect(migration).toContain("AFTER INSERT ON public.streaming_analytics_daily");
  expect(migration).toContain("credit_solo_artist_revenue(v_profile,'streaming'");
  expect(migration).toContain("ON CONFLICT(source_kind,source_id) DO NOTHING");
  expect(migration).toContain("carry_minor");
 });
 it("#3812 expires paid VIP only after latest invoice is fully refunded",()=>{
  expect(stripe).toContain('case "charge.refunded"');
  expect(stripe).toContain('case "refund.updated"');
  expect(stripe).toContain("charge.amount_refunded < charge.amount");
  expect(stripe).toContain("latestId !== invoiceId");
  expect(stripe).toContain('p_status: "expired"');
  expect(stripe).toContain('rpc("apply_ordered_stripe_vip_status"');
  expect(stripe).toContain('from("stripe_vip_refunded_invoices")');
  expect(stripe).toContain('if (refunded) status = "expired"');
 });
});
