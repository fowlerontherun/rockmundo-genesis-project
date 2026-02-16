import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startJobRun, completeJobRun, failJobRun, safeJson } from "../_shared/job-logger.ts";

const JOB_NAME = "update-housing-market";

Deno.serve(async (req) => {
  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const runId = await startJobRun({
    jobName: JOB_NAME,
    functionName: "update-housing-market",
    supabaseClient: supabase,
    triggeredBy: "cron",
    requestPayload: await safeJson(req),
  });

  try {
    // Get all distinct countries from housing_types
    const { data: countries, error: countriesErr } = await supabase
      .from("housing_types")
      .select("country")
      .eq("is_active", true);
    if (countriesErr) throw countriesErr;

    const uniqueCountries = [...new Set(countries?.map((c) => c.country).filter(Boolean) ?? [])];

    // Get existing market prices
    const { data: existingPrices } = await supabase
      .from("housing_market_prices")
      .select("country, price_multiplier, trend, trend_strength");

    const priceMap = new Map(
      (existingPrices ?? []).map((p) => [p.country, p])
    );

    const upserts: Array<{
      country: string;
      price_multiplier: number;
      trend: string;
      trend_strength: number;
      last_updated_at: string;
    }> = [];

    for (const country of uniqueCountries) {
      const existing = priceMap.get(country);
      const currentMultiplier = existing ? Number(existing.price_multiplier) : 1.0;
      let trend = existing?.trend ?? "stable";
      let trendStrength = existing ? Number(existing.trend_strength) : 0;

      // Random chance to change trend direction (15% chance)
      if (Math.random() < 0.15) {
        const roll = Math.random();
        if (roll < 0.33) trend = "rising";
        else if (roll < 0.66) trend = "falling";
        else trend = "stable";
        trendStrength = Math.random() * 0.03; // 0-3% strength
      }

      // Calculate price change based on trend + randomness
      let change = 0;
      const noise = (Math.random() - 0.5) * 0.02; // ±1% random noise

      if (trend === "rising") {
        change = trendStrength + noise;
      } else if (trend === "falling") {
        change = -trendStrength + noise;
      } else {
        change = noise;
      }

      // Apply change, clamp between 0.70 and 1.40 (±30-40% from base)
      let newMultiplier = currentMultiplier * (1 + change);
      newMultiplier = Math.max(0.70, Math.min(1.40, newMultiplier));
      newMultiplier = Math.round(newMultiplier * 10000) / 10000;

      // Slight mean reversion when far from 1.0
      if (newMultiplier > 1.25) {
        newMultiplier -= 0.002;
      } else if (newMultiplier < 0.80) {
        newMultiplier += 0.002;
      }

      upserts.push({
        country,
        price_multiplier: newMultiplier,
        trend,
        trend_strength: Math.round(trendStrength * 1000) / 1000,
        last_updated_at: new Date().toISOString(),
      });
    }

    // Batch upsert
    const { error: upsertErr } = await supabase
      .from("housing_market_prices")
      .upsert(upserts, { onConflict: "country" });
    if (upsertErr) throw upsertErr;

    const durationMs = Date.now() - startTime;
    await completeJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs,
      processedCount: upserts.length,
      resultSummary: { countries_updated: upserts.length },
    });

    return new Response(
      JSON.stringify({ success: true, countries_updated: upserts.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await failJobRun({
      jobName: JOB_NAME,
      runId,
      supabaseClient: supabase,
      durationMs,
      error,
    });

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
