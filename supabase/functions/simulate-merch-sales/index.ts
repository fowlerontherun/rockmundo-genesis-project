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

// Countries weighted by music market size
const COUNTRIES = [
  { name: "United States", weight: 30 },
  { name: "United Kingdom", weight: 15 },
  { name: "Germany", weight: 10 },
  { name: "Japan", weight: 8 },
  { name: "France", weight: 6 },
  { name: "Canada", weight: 5 },
  { name: "Australia", weight: 5 },
  { name: "Brazil", weight: 4 },
  { name: "Mexico", weight: 3 },
  { name: "Spain", weight: 3 },
  { name: "Italy", weight: 3 },
  { name: "Netherlands", weight: 2 },
  { name: "Sweden", weight: 2 },
  { name: "South Korea", weight: 2 },
  { name: "Other", weight: 2 },
];

const ORDER_TYPES = ["online", "gig", "store"];
const CUSTOMER_TYPES = ["fan", "collector", "superfan"];

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
        player_merchandise(id, item_type, design_name, selling_price, stock_quantity, quality_tier)
      `)
      .gt("total_fans", 0);

    if (bandsError) throw bandsError;

    console.log(`[${JOB_NAME}] Found ${bandsWithMerch?.length || 0} bands with fans`);

    let totalOrders = 0;
    let totalRevenue = 0;

    for (const band of bandsWithMerch || []) {
      const merchandise = band.player_merchandise || [];
      if (merchandise.length === 0) continue;

      // Calculate daily sales based on fan count and fame
      // Base: 0.1% of fans buy merch per day, scaled by fame
      const baseSalesChance = 0.001;
      const fameMultiplier = 1 + Math.min((band.fame || 0) / 5000, 2); // Max 3x
      const dailySalesTarget = Math.max(1, Math.floor(
        (band.total_fans || 0) * baseSalesChance * fameMultiplier
      ));

      // Random variation: 50% to 150% of target
      const actualSales = Math.floor(dailySalesTarget * (0.5 + Math.random()));

      console.log(`[${JOB_NAME}] Band ${band.name}: targeting ${actualSales} sales from ${band.total_fans} fans`);

      const ordersToInsert = [];

      for (let i = 0; i < actualSales; i++) {
        // Pick random merchandise (weighted by quality - better items sell more)
        const qualityWeights: Record<string, number> = {
          exclusive: 5,
          premium: 4,
          standard: 3,
          basic: 2,
          poor: 1,
        };

        const weightedMerch = merchandise.map(m => ({
          ...m,
          weight: qualityWeights[m.quality_tier || 'basic'] || 2,
        }));

        const selectedMerch = weightedRandomSelect(weightedMerch);
        if (!selectedMerch || selectedMerch.stock_quantity <= 0) continue;

        // Determine quantity (1-3, usually 1)
        const quantity = Math.random() > 0.85 ? (Math.random() > 0.7 ? 3 : 2) : 1;

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

        // Select country
        const country = weightedRandomSelect(COUNTRIES).name;

        const unitPrice = selectedMerch.selling_price || 20;
        const totalPrice = unitPrice * quantity;

        ordersToInsert.push({
          band_id: band.id,
          merchandise_id: selectedMerch.id,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          order_type: orderType,
          customer_type: customerType,
          country,
        });

        totalRevenue += totalPrice;
      }

      if (ordersToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("merch_orders")
          .insert(ordersToInsert);

        if (insertError) {
          console.error(`[${JOB_NAME}] Failed to insert orders for band ${band.id}:`, insertError);
        } else {
          totalOrders += ordersToInsert.length;
          console.log(`[${JOB_NAME}] Inserted ${ordersToInsert.length} orders for ${band.name}`);

          // Add revenue to band earnings
          const bandRevenue = ordersToInsert.reduce((sum, o) => sum + o.total_price, 0);
          await supabase.from("band_earnings").insert({
            band_id: band.id,
            amount: bandRevenue,
            source: "merchandise",
            description: `Daily merch sales: ${ordersToInsert.length} orders`,
          });
        }
      }
    }

    console.log(`[${JOB_NAME}] Complete. Total orders: ${totalOrders}, Revenue: $${totalRevenue}`);

    await completeJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startTime,
      processedCount: totalOrders,
      resultSummary: { totalOrders, totalRevenue, bandsProcessed: bandsWithMerch?.length || 0 },
    });

    return new Response(
      JSON.stringify({ success: true, totalOrders, totalRevenue }),
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