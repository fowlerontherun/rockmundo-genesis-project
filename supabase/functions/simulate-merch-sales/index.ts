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

// Countries weighted by music market size, with VAT rates
const COUNTRIES: { name: string; weight: number; vatRate: number; salesTaxRate: number }[] = [
  { name: "United States", weight: 30, vatRate: 0, salesTaxRate: 0.08 }, // Average US sales tax ~8%
  { name: "United Kingdom", weight: 15, vatRate: 0.20, salesTaxRate: 0 }, // UK VAT 20%
  { name: "Germany", weight: 10, vatRate: 0.19, salesTaxRate: 0 }, // German VAT 19%
  { name: "Japan", weight: 8, vatRate: 0.10, salesTaxRate: 0 }, // Japan consumption tax 10%
  { name: "France", weight: 6, vatRate: 0.20, salesTaxRate: 0 }, // French VAT 20%
  { name: "Canada", weight: 5, vatRate: 0, salesTaxRate: 0.13 }, // Average Canadian HST ~13%
  { name: "Australia", weight: 5, vatRate: 0.10, salesTaxRate: 0 }, // Australian GST 10%
  { name: "Brazil", weight: 4, vatRate: 0.17, salesTaxRate: 0 }, // Brazilian ICMS ~17%
  { name: "Mexico", weight: 3, vatRate: 0.16, salesTaxRate: 0 }, // Mexican VAT 16%
  { name: "Spain", weight: 3, vatRate: 0.21, salesTaxRate: 0 }, // Spanish VAT 21%
  { name: "Italy", weight: 3, vatRate: 0.22, salesTaxRate: 0 }, // Italian VAT 22%
  { name: "Netherlands", weight: 2, vatRate: 0.21, salesTaxRate: 0 }, // Dutch VAT 21%
  { name: "Sweden", weight: 2, vatRate: 0.25, salesTaxRate: 0 }, // Swedish VAT 25%
  { name: "South Korea", weight: 2, vatRate: 0.10, salesTaxRate: 0 }, // Korean VAT 10%
  { name: "Other", weight: 2, vatRate: 0.15, salesTaxRate: 0 }, // Average global VAT
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    console.log(`[${JOB_NAME}] Starting merchandise sales simulation...`);

    // Get all bands with merchandise and fans
    const { data: bandsWithMerch, error: bandsError } = await supabase
      .from("bands")
      .select(`
        id, name, fame, total_fans, casual_fans, dedicated_fans, superfans,
        player_merchandise(id, item_type, design_name, selling_price, stock_quantity, quality_tier, production_cost)
      `)
      .gt("total_fans", 0);

    if (bandsError) throw bandsError;

    // === FETCH BAND SENTIMENT FOR MERCH DEMAND (v1.0.947) ===
    const bandSentimentMap = new Map<string, number>();
    try {
      const bandIds = (bandsWithMerch || []).map(b => b.id);
      if (bandIds.length > 0) {
        const { data: bandExtras } = await supabase
          .from('bands')
          .select('id, fan_sentiment_score')
          .in('id', bandIds);
        for (const b of bandExtras || []) {
          bandSentimentMap.set(b.id, (b as any).fan_sentiment_score ?? 0);
        }
      }
    } catch (sentErr) {
      console.error(`[${JOB_NAME}] Error fetching sentiment:`, sentErr);
    }

    console.log(`[${JOB_NAME}] Found ${bandsWithMerch?.length || 0} bands with fans`);

    let totalOrders = 0;
    let totalRevenue = 0;
    let totalTaxes = 0;
    let totalNetRevenue = 0;
    let totalStockReduced = 0;

    for (const band of bandsWithMerch || []) {
      const merchandise = band.player_merchandise || [];
      if (merchandise.length === 0) continue;

      // Track stock changes for this band
      const stockUpdates: Map<string, number> = new Map();

      // Calculate daily sales based on fan count and fame
      // Base: 0.1% of fans buy merch per day, scaled by fame
      const baseSalesChance = 0.001;
      const fameMultiplier = 1 + Math.min((band.fame || 0) / 5000, 2); // Max 3x

      // === SENTIMENT MERCH DEMAND MODIFIER (v1.0.947) ===
      const sentimentScore = bandSentimentMap.get(band.id) ?? 0;
      const sentimentT = (Math.max(-100, Math.min(100, sentimentScore)) + 100) / 200; // 0 to 1
      const merchDemandMod = parseFloat((0.5 + sentimentT * 1.0).toFixed(2)); // 0.5x to 1.5x

      const dailySalesTarget = Math.max(1, Math.floor(
        (band.total_fans || 0) * baseSalesChance * fameMultiplier * merchDemandMod
      ));

      // Random variation: 50% to 150% of target
      const actualSales = Math.floor(dailySalesTarget * (0.5 + Math.random()));

      console.log(`[${JOB_NAME}] Band ${band.name}: targeting ${actualSales} sales from ${band.total_fans} fans`);

      const ordersToInsert = [];

      // Create a mutable copy of merchandise to track stock during this batch
      const merchWithCurrentStock = merchandise.map(m => ({
        ...m,
        currentStock: m.stock_quantity,
      }));

      for (let i = 0; i < actualSales; i++) {
        // Pick random merchandise (weighted by quality - better items sell more)
        const qualityWeights: Record<string, number> = {
          exclusive: 5,
          premium: 4,
          standard: 3,
          basic: 2,
          poor: 1,
        };

        const availableMerch = merchWithCurrentStock.filter(m => m.currentStock > 0);
        if (availableMerch.length === 0) {
          console.log(`[${JOB_NAME}] Band ${band.name}: Out of stock on all items`);
          break;
        }

        const weightedMerch = availableMerch.map(m => ({
          ...m,
          weight: qualityWeights[m.quality_tier || 'basic'] || 2,
        }));

        const selectedMerch = weightedRandomSelect(weightedMerch);
        if (!selectedMerch) continue;

        // Determine quantity (1-3, usually 1) - but cap at available stock
        let quantity = Math.random() > 0.85 ? (Math.random() > 0.7 ? 3 : 2) : 1;
        quantity = Math.min(quantity, selectedMerch.currentStock);

        if (quantity <= 0) continue;

        // Update the current stock tracker
        const merchIndex = merchWithCurrentStock.findIndex(m => m.id === selectedMerch.id);
        if (merchIndex >= 0) {
          merchWithCurrentStock[merchIndex].currentStock -= quantity;
        }

        // Track total stock reduction per merchandise item
        const currentReduction = stockUpdates.get(selectedMerch.id) || 0;
        stockUpdates.set(selectedMerch.id, currentReduction + quantity);
        totalStockReduced += quantity;

        // Determine order type
        const orderType = ORDER_TYPES[Math.floor(Math.random() * ORDER_TYPES.length)];

        // Determine customer type based on fan composition
        let customerType = "fan";
        const rand = Math.random();
        const superfanRatio = (band.superfans || 0) / Math.max(1, band.total_fans || 1);
        const dedicatedRatio = (band.dedicated_fans || 0) / Math.max(1, band.total_fans || 1);

        if (rand < superfanRatio * 2) {
          customerType = "superfan";
        } else if (rand < (superfanRatio * 2 + dedicatedRatio)) {
          customerType = "collector";
        }

        // Select country with tax rates
        const selectedCountry = weightedRandomSelect(COUNTRIES);
        const country = selectedCountry.name;

        const unitPrice = Math.min(selectedMerch.selling_price || 20, 9999); // Cap at max price
        const productionCost = selectedMerch.production_cost || 0;
        const subtotal = unitPrice * quantity;
        const totalCost = productionCost * quantity;

        // Calculate taxes (keep as decimals for numeric columns)
        const salesTax = Math.round(subtotal * selectedCountry.salesTaxRate * 100) / 100;
        const vat = Math.round(subtotal * selectedCountry.vatRate * 100) / 100;
        // total_price and unit_price are INTEGER columns - must be whole numbers
        const totalPrice = Math.round(subtotal + salesTax + vat);
        // Net revenue = sales minus taxes minus production costs
        const netRevenue = Math.max(0, subtotal - totalCost);

        ordersToInsert.push({
          band_id: band.id,
          merchandise_id: selectedMerch.id,
          quantity,
          unit_price: Math.round(unitPrice),
          total_price: totalPrice,
          sales_tax: salesTax,
          vat: vat,
          net_revenue: netRevenue,
          order_type: orderType,
          customer_type: customerType,
          country,
        });

        totalRevenue += totalPrice;
        totalTaxes += salesTax + vat;
        totalNetRevenue += netRevenue;
      }

      if (ordersToInsert.length > 0) {
        // Insert orders
        const { error: insertError } = await supabase
          .from("merch_orders")
          .insert(ordersToInsert);

        if (insertError) {
          console.error(`[${JOB_NAME}] Failed to insert orders for band ${band.id}:`, insertError);
          continue;
        }

        totalOrders += ordersToInsert.length;
        console.log(`[${JOB_NAME}] Inserted ${ordersToInsert.length} orders for ${band.name}`);

        // Update stock levels for each merchandise item
        for (const [merchId, reduction] of stockUpdates) {
          // Use the decrement_merch_stock RPC function
          const { error: stockUpdateError } = await supabase.rpc(
            "decrement_merch_stock",
            { merch_id: merchId, amount: reduction }
          );

          if (stockUpdateError) {
            console.error(`[${JOB_NAME}] Failed to update stock for merch ${merchId}:`, stockUpdateError);
            // Fallback: direct update
            const { data: currentMerch } = await supabase
              .from("player_merchandise")
              .select("stock_quantity")
              .eq("id", merchId)
              .single();
            
            if (currentMerch) {
              const newStock = Math.max(0, (currentMerch.stock_quantity || 0) - reduction);
              await supabase
                .from("player_merchandise")
                .update({ stock_quantity: newStock })
                .eq("id", merchId);
            }
          }
        }

        // Add NET revenue (after taxes) to band earnings
        const bandGrossRevenue = ordersToInsert.reduce((sum, o) => sum + o.total_price, 0);
        const bandNetRevenue = ordersToInsert.reduce((sum, o) => sum + o.net_revenue, 0);
        const bandTotalTaxes = ordersToInsert.reduce((sum, o) => sum + o.sales_tax + o.vat, 0);
        const bandTotalCosts = ordersToInsert.reduce((sum, o) => sum + (o.unit_price * o.quantity) - o.net_revenue - o.sales_tax - o.vat, 0);
        
        // ── 360 Deal: Check if band has a label contract that takes merch cut ──
        let labelMerchCut = 0;
        let finalBandRevenue = bandNetRevenue;
        
        try {
          const { data: active360 } = await supabase
            .from('artist_label_contracts')
            .select('id, label_id, royalty_label_pct, deal_type_id, label_deal_types:deal_type_id(name)')
            .eq('band_id', band.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();
          
          if (active360 && bandNetRevenue > 0) {
            const dealName = (active360 as any).label_deal_types?.name || '';
            if (dealName === '360 Deal') {
              const labelPct = (active360.royalty_label_pct || 20) / 100;
              labelMerchCut = Math.round(bandNetRevenue * labelPct);
              finalBandRevenue = bandNetRevenue - labelMerchCut;
              
              // Credit label
              const { data: label } = await supabase
                .from('labels')
                .select('balance')
                .eq('id', active360.label_id)
                .single();
              
              if (label) {
                await supabase
                  .from('labels')
                  .update({ balance: (label.balance || 0) + labelMerchCut })
                  .eq('id', active360.label_id);
              }
              
              await supabase.from('label_financial_transactions').insert({
                label_id: active360.label_id,
                transaction_type: 'revenue',
                amount: labelMerchCut,
                description: `360 Deal merch cut: ${ordersToInsert.length} orders from ${band.name}`,
                related_contract_id: active360.id,
                related_band_id: band.id,
              });
              
              console.log(`[${JOB_NAME}] 360 Deal: label takes $${labelMerchCut} from merch (${(labelPct * 100).toFixed(0)}%)`);
            }
          }
        } catch (e) {
          console.log(`[${JOB_NAME}] Error checking 360 deal for merch:`, e);
        }
        
        // Only credit positive earnings
        if (finalBandRevenue > 0) {
          await supabase.from("band_earnings").insert({
            band_id: band.id,
            amount: Math.round(finalBandRevenue),
            source: "merchandise",
            description: `Daily merch sales: ${ordersToInsert.length} orders (costs: $${Math.abs(bandTotalCosts).toFixed(0)}, taxes: $${bandTotalTaxes.toFixed(0)})${labelMerchCut > 0 ? ` [360 deal: $${labelMerchCut} to label]` : ''}`,
            metadata: {
              orders_count: ordersToInsert.length,
              gross_revenue: bandGrossRevenue,
              production_costs: bandTotalCosts,
              sales_tax_collected: ordersToInsert.reduce((sum, o) => sum + o.sales_tax, 0),
              vat_collected: ordersToInsert.reduce((sum, o) => sum + o.vat, 0),
              net_revenue: finalBandRevenue,
              label_merch_cut: labelMerchCut,
              stock_reduced: Array.from(stockUpdates.entries()).reduce((sum, [_, qty]) => sum + qty, 0),
            },
          });
        }

        console.log(`[${JOB_NAME}] Added $${finalBandRevenue.toFixed(2)} to band earnings (after $${bandTotalTaxes.toFixed(2)} taxes${labelMerchCut > 0 ? `, $${labelMerchCut} to label` : ''})`);
      }
    }

    console.log(`[${JOB_NAME}] Complete. Total orders: ${totalOrders}, Gross: $${totalRevenue.toFixed(2)}, Taxes: $${totalTaxes.toFixed(2)}, Net: $${totalNetRevenue.toFixed(2)}, Stock reduced: ${totalStockReduced}`);

    await completeJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      processedCount: totalOrders,
      resultSummary: { 
        totalOrders, 
        grossRevenue: totalRevenue,
        totalTaxes,
        netRevenue: totalNetRevenue,
        stockReduced: totalStockReduced,
        bandsProcessed: bandsWithMerch?.length || 0 
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalOrders, 
        grossRevenue: totalRevenue,
        totalTaxes,
        netRevenue: totalNetRevenue,
        stockReduced: totalStockReduced,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[${JOB_NAME}] Error:`, error);
    await failJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      error,
    });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
