import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  startJobRun,
  completeJobRun,
  failJobRun,
  safeJson,
} from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOB_NAME = "simulate-merch-sales";

const COUNTRIES: { name: string; weight: number; vatRate: number; salesTaxRate: number }[] = [
  { name: "United States", weight: 30, vatRate: 0, salesTaxRate: 0.08 },
  { name: "United Kingdom", weight: 15, vatRate: 0.20, salesTaxRate: 0 },
  { name: "Germany", weight: 10, vatRate: 0.19, salesTaxRate: 0 },
  { name: "Japan", weight: 8, vatRate: 0.10, salesTaxRate: 0 },
  { name: "France", weight: 6, vatRate: 0.20, salesTaxRate: 0 },
  { name: "Canada", weight: 5, vatRate: 0, salesTaxRate: 0.13 },
  { name: "Australia", weight: 5, vatRate: 0.10, salesTaxRate: 0 },
  { name: "Brazil", weight: 4, vatRate: 0.17, salesTaxRate: 0 },
  { name: "Mexico", weight: 3, vatRate: 0.16, salesTaxRate: 0 },
  { name: "Spain", weight: 3, vatRate: 0.21, salesTaxRate: 0 },
  { name: "Italy", weight: 3, vatRate: 0.22, salesTaxRate: 0 },
  { name: "Netherlands", weight: 2, vatRate: 0.21, salesTaxRate: 0 },
  { name: "Sweden", weight: 2, vatRate: 0.25, salesTaxRate: 0 },
  { name: "South Korea", weight: 2, vatRate: 0.10, salesTaxRate: 0 },
  { name: "Other", weight: 2, vatRate: 0.15, salesTaxRate: 0 },
];

const ORDER_TYPES = ["online", "gig", "store"];

function weightedRandomSelect<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const startTime = Date.now();
  const runId = await startJobRun({
    jobName: JOB_NAME,
    functionName: "simulate-merch-sales",
    supabaseClient: supabase,
    triggeredBy: "cron",
    requestPayload: await safeJson(req),
  });

  try {
    const { data: bandsWithMerch, error: bandsError } = await supabase
      .from("bands")
      .select(`
        id, name, fame, total_fans, casual_fans, dedicated_fans, superfans, home_city_id,
        fan_sentiment_score, reputation_score,
        player_merchandise(id, item_type, design_name, selling_price, stock_quantity, quality_tier, cost_to_produce, superfan_only, drop_starts_at, available_until, is_limited_edition, limited_quantity, tour_exclusive_tour_id)
      `)
      .gt("total_fans", 0);
    if (bandsError) throw bandsError;

    const variantMap = new Map<string, Array<{ id: string; merchandise_id: string; stock_quantity: number; selling_price_override: number | null; cost_to_produce_override: number | null; is_active: boolean }>>();
    const merchIds = (bandsWithMerch || []).flatMap((b: any) => (b.player_merchandise || []).map((m: any) => m.id));
    if (merchIds.length > 0) {
      const { data: variants, error: variantError } = await supabase
        .from("merch_variants")
        .select("id, merchandise_id, stock_quantity, selling_price_override, cost_to_produce_override, is_active")
        .in("merchandise_id", merchIds)
        .eq("is_active", true);
      if (variantError) throw variantError;
      for (const variant of variants || []) {
        const list = variantMap.get((variant as any).merchandise_id) || [];
        list.push(variant as any);
        variantMap.set((variant as any).merchandise_id, list);
      }
    }

    let totalOrders = 0;
    let totalRevenue = 0;
    let totalTaxes = 0;
    let totalNetRevenue = 0;
    let totalStockReduced = 0;
    let rejectedForStock = 0;

    for (const band of bandsWithMerch || []) {
      const merchandise = (band as any).player_merchandise || [];
      if (merchandise.length === 0) continue;

      const sentimentT = (Math.max(-100, Math.min(100, (band as any).fan_sentiment_score ?? 0)) + 100) / 200;
      const merchDemandMod = 0.5 + sentimentT;
      const repT = (Math.max(-100, Math.min(100, (band as any).reputation_score ?? 0)) + 100) / 200;
      const merchRepMod = 0.8 + repT * 0.4;
      const fameMultiplier = 1 + Math.min(((band as any).fame || 0) / 5000, 2);
      const dailySalesTarget = Math.max(1, Math.floor(((band as any).total_fans || 0) * 0.001 * fameMultiplier * merchDemandMod * merchRepMod));
      const actualSales = Math.floor(dailySalesTarget * (0.5 + Math.random()));

      const variantStateMap = new Map<string, Array<{ id: string; stock: number; price: number | null; cost: number | null }>>();
      const merchState = merchandise.map((m: any) => {
        const variants = (variantMap.get(m.id) || []).map(v => ({
          id: v.id,
          stock: v.stock_quantity || 0,
          price: v.selling_price_override,
          cost: v.cost_to_produce_override,
        }));
        if (variants.length > 0) variantStateMap.set(m.id, variants);
        return {
          ...m,
          hasVariants: variants.length > 0,
          currentStock: variants.length > 0 ? variants.reduce((sum, v) => sum + v.stock, 0) : (m.stock_quantity || 0),
        };
      });

      const successfulOrders: any[] = [];
      const superfanRatio = ((band as any).superfans || 0) / Math.max(1, (band as any).total_fans || 1);
      const dedicatedRatio = ((band as any).dedicated_fans || 0) / Math.max(1, (band as any).total_fans || 1);

      for (let i = 0; i < actualSales; i++) {
        let customerType = "fan";
        const fanRoll = Math.random();
        if (fanRoll < superfanRatio * 2) customerType = "superfan";
        else if (fanRoll < superfanRatio * 2 + dedicatedRatio) customerType = "collector";

        const nowMs = Date.now();
        const available = merchState.filter((m: any) => {
          if (m.currentStock <= 0) return false;
          if (m.drop_starts_at && new Date(m.drop_starts_at).getTime() > nowMs) return false;
          if (m.available_until && new Date(m.available_until).getTime() < nowMs) return false;
          if (m.superfan_only && customerType !== "superfan") return false;
          return true;
        });
        if (available.length === 0) break;

        const qualityWeights: Record<string, number> = { exclusive: 5, premium: 4, standard: 3, basic: 2, poor: 1 };
        const selected: any = weightedRandomSelect(available.map((m: any) => ({ ...m, weight: qualityWeights[m.quality_tier || "basic"] || 2 })));

        let variantId: string | null = null;
        let variantPrice: number | null = null;
        let variantCost: number | null = null;
        let localVariant: { id: string; stock: number; price: number | null; cost: number | null } | undefined;
        if (selected.hasVariants) {
          const stocked = (variantStateMap.get(selected.id) || []).filter(v => v.stock > 0);
          if (stocked.length === 0) {
            selected.currentStock = 0;
            continue;
          }
          localVariant = stocked[Math.floor(Math.random() * stocked.length)];
          variantId = localVariant.id;
          variantPrice = localVariant.price;
          variantCost = localVariant.cost;
        }

        let quantity = Math.random() > 0.85 ? (Math.random() > 0.7 ? 3 : 2) : 1;
        quantity = Math.min(quantity, variantId ? (localVariant?.stock || 0) : selected.currentStock);
        if (quantity <= 0) continue;

        const discountPct = customerType === "superfan" ? 10 : customerType === "collector" ? 5 : 0;
        const selectedCountry = weightedRandomSelect(COUNTRIES);
        const baseUnitPrice = variantPrice ?? selected.selling_price ?? 20;
        const productionCost = variantCost ?? selected.cost_to_produce ?? 0;
        const unitPrice = Math.min(Math.max(1, Math.round(baseUnitPrice * (1 - discountPct / 100))), 9999);
        const subtotal = unitPrice * quantity;
        const totalCost = productionCost * quantity;
        const salesTax = Math.round(subtotal * selectedCountry.salesTaxRate * 100) / 100;
        const vat = Math.round(subtotal * selectedCountry.vatRate * 100) / 100;
        const totalPrice = Math.round(subtotal + salesTax + vat);
        // Manufacturing was already charged when the stock was ordered. Sale proceeds
        // must therefore not deduct the same production cost a second time.
        const netRevenue = subtotal;
        const orderType = ORDER_TYPES[Math.floor(Math.random() * ORDER_TYPES.length)];

        const { data: saleResult, error: saleError } = await supabase.rpc("record_merch_sale_atomic", {
          p_band_id: (band as any).id,
          p_merchandise_id: selected.id,
          p_variant_id: variantId,
          p_quantity: quantity,
          p_unit_price: unitPrice,
          p_total_price: totalPrice,
          p_sales_tax: salesTax,
          p_vat: vat,
          p_net_revenue: netRevenue,
          p_order_type: orderType,
          p_customer_type: customerType,
          p_country: selectedCountry.name,
          p_discount_pct: discountPct,
        });

        if (saleError) {
          console.error(`[${JOB_NAME}] Atomic sale failed for ${selected.id}:`, saleError);
          continue;
        }

        const result = saleResult as any;
        if (!result?.sold) {
          rejectedForStock++;
          const remaining = Number(result?.remaining_stock ?? 0);
          if (variantId && localVariant) {
            localVariant.stock = remaining;
            selected.currentStock = (variantStateMap.get(selected.id) || []).reduce((sum, v) => sum + v.stock, 0);
          } else {
            selected.currentStock = remaining;
          }
          continue;
        }

        const remaining = Number(result.remaining_stock ?? 0);
        if (variantId && localVariant) {
          localVariant.stock = remaining;
          selected.currentStock = (variantStateMap.get(selected.id) || []).reduce((sum, v) => sum + v.stock, 0);
        } else {
          selected.currentStock = remaining;
        }

        const order = {
          merchandise_id: selected.id,
          variant_id: variantId,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          sales_tax: salesTax,
          vat,
          net_revenue: netRevenue,
          production_cost: totalCost,
          order_type: orderType,
          customer_type: customerType,
        };
        successfulOrders.push(order);
        totalOrders++;
        totalRevenue += totalPrice;
        totalTaxes += salesTax + vat;
        totalNetRevenue += netRevenue;
        totalStockReduced += quantity;
      }

      if (successfulOrders.length === 0) continue;

      const bandGrossRevenue = successfulOrders.reduce((sum, o) => sum + o.total_price, 0);
      const bandNetRevenue = successfulOrders.reduce((sum, o) => sum + o.net_revenue, 0);
      const bandTotalTaxes = successfulOrders.reduce((sum, o) => sum + o.sales_tax + o.vat, 0);
      const bandTotalCosts = successfulOrders.reduce((sum, o) => sum + o.production_cost, 0);

      if ((band as any).home_city_id && bandTotalTaxes > 0) {
        const { error: treasuryError } = await supabase.rpc("credit_city_treasury", {
          p_city_id: (band as any).home_city_id,
          p_amount: bandTotalTaxes,
          p_type: "merch_sales_tax",
          p_description: `Merch sales tax for ${(band as any).name} (${successfulOrders.length} orders)`,
          p_reference_id: (band as any).id,
        });
        if (treasuryError) console.error(`[${JOB_NAME}] Failed to credit merch tax:`, treasuryError);
      }

      let labelMerchCut = 0;
      let finalBandRevenue = bandNetRevenue;
      const { data: active360, error: contractError } = await supabase
        .from("artist_label_contracts")
        .select("id, label_id, royalty_label_pct, deal_type_id, label_deal_types:deal_type_id(name)")
        .eq("band_id", (band as any).id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (contractError) console.error(`[${JOB_NAME}] 360 contract lookup failed:`, contractError);

      if (active360 && (active360 as any).label_deal_types?.name === "360 Deal" && bandNetRevenue > 0) {
        const labelPct = (((active360 as any).royalty_label_pct ?? 20) as number) / 100;
        const proposedCut = Math.round(bandNetRevenue * labelPct);
        if (proposedCut > 0) {
          const { error: labelCreditError } = await supabase.rpc("credit_label_merch_revenue_atomic", {
            p_label_id: (active360 as any).label_id,
            p_amount: proposedCut,
            p_description: `360 Deal merch cut: ${successfulOrders.length} orders from ${(band as any).name}`,
            p_related_contract_id: (active360 as any).id,
            p_related_band_id: (band as any).id,
          });
          if (labelCreditError) {
            console.error(`[${JOB_NAME}] 360 label credit failed; retaining revenue with band:`, labelCreditError);
          } else {
            labelMerchCut = proposedCut;
            finalBandRevenue -= labelMerchCut;
          }
        }
      }

      if (finalBandRevenue > 0) {
        try {
          const { data: bandHealth } = await supabase.from("bands").select("morale").eq("id", (band as any).id).single();
          if (bandHealth) {
            const moraleBoost = finalBandRevenue >= 5000 ? 4 : finalBandRevenue >= 1000 ? 3 : finalBandRevenue >= 200 ? 2 : 1;
            const newMorale = Math.min(100, ((bandHealth as any).morale ?? 50) + moraleBoost);
            await supabase.from("bands").update({ morale: newMorale }).eq("id", (band as any).id);
            await supabase.from("band_health_events").insert({
              band_id: (band as any).id,
              event_type: "morale",
              delta: moraleBoost,
              new_value: newMorale,
              source: "merch_sales",
              description: `Merch sales: $${Math.round(finalBandRevenue).toLocaleString()} revenue (${successfulOrders.length} orders)`,
            });
          }
        } catch (moraleError) {
          console.error(`[${JOB_NAME}] Morale update failed:`, moraleError);
        }

        const { error: earningsError } = await supabase.from("band_earnings").insert({
          band_id: (band as any).id,
          amount: Math.round(finalBandRevenue),
          source: "merchandise",
          description: `Daily merch sales: ${successfulOrders.length} orders (inventory production cost already paid: $${bandTotalCosts.toFixed(0)}, taxes: $${bandTotalTaxes.toFixed(0)})${labelMerchCut > 0 ? ` [360 deal: $${labelMerchCut} to label]` : ""}`,
          metadata: {
            orders_count: successfulOrders.length,
            gross_revenue: bandGrossRevenue,
            production_cost_basis: bandTotalCosts,
            production_cost_paid_at_manufacture: true,
            sales_tax_collected: successfulOrders.reduce((sum, o) => sum + o.sales_tax, 0),
            vat_collected: successfulOrders.reduce((sum, o) => sum + o.vat, 0),
            net_revenue: finalBandRevenue,
            label_merch_cut: labelMerchCut,
            stock_reduced: successfulOrders.reduce((sum, o) => sum + o.quantity, 0),
          },
        });
        if (earningsError) console.error(`[${JOB_NAME}] Failed to record band merch earnings:`, earningsError);
      }
    }

    await completeJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      processedCount: totalOrders,
      errorCount: rejectedForStock,
      resultSummary: {
        totalOrders,
        grossRevenue: totalRevenue,
        totalTaxes,
        netRevenue: totalNetRevenue,
        stockReduced: totalStockReduced,
        rejectedForStock,
        bandsProcessed: bandsWithMerch?.length || 0,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      totalOrders,
      grossRevenue: totalRevenue,
      totalTaxes,
      netRevenue: totalNetRevenue,
      stockReduced: totalStockReduced,
      rejectedForStock,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error(`[${JOB_NAME}] Error:`, error);
    await failJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      error,
    });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
