import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const spend=readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261013140000_atomic_attribute_spend.sql",import.meta.url)),"utf8");
const conversion=readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261013140500_atomic_ap_conversion.sql",import.meta.url)),"utf8");
const handler=readFileSync(fileURLToPath(new URL("../../../supabase/functions/progression/handlers.ts",import.meta.url)),"utf8");
describe("progression financial integrity contracts",()=>{
 it("#3881 debits AP in the same transaction as attribute increase",()=>{
 expect(spend).toContain("FOR UPDATE");expect(spend).toContain("UPDATE public.player_xp_wallet SET");
 expect(spend).toContain("UPDATE public.player_attributes SET");
 expect(handler).toContain('client.rpc("spend_attribute_points_atomic"');
 });
 it("#3883 enforces allowable attributes and cap",()=>{
 expect(spend).toContain("p_attribute NOT IN");
 expect(spend).toContain("ATTRIBUTE_CAP_EXCEEDED");
 expect(spend).toContain("v_value+p_cost>100");
 });
 it("#3884 couples conversion to the ledger entry",()=>{
 expect(conversion).toContain("INSERT INTO public.xp_ledger");
 expect(conversion).toContain("UPDATE public.player_xp_wallet");
 expect(handler).toContain('client.rpc("convert_ap_to_sxp_atomic"');
 });
});