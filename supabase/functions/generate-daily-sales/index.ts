import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-triggered-by",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let runId: string | null = null;
  const startedAt = Date.now();
  let totalSales = 0;
  let releasesProcessed = 0;
  let errorCount = 0;

  try {
    runId = await startJobRun({
      jobName: "generate-daily-sales",
      functionName: "generate-daily-sales",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    // Fetch sales config from database
    const { data: salesConfigData } = await supabaseClient
      .from("game_balance_config")
      .select("key, value")
      .eq("category", "sales");
    
    const salesConfig: Record<string, number> = {};
    (salesConfigData || []).forEach((item: any) => {
      salesConfig[item.key] = item.value as number;
    });
    
    // Config values with defaults
    const digitalMin = salesConfig.digital_base_sales_min ?? 5;
    const digitalMax = salesConfig.digital_base_sales_max ?? 25;
    const cdMin = salesConfig.cd_base_sales_min ?? 2;
    const cdMax = salesConfig.cd_base_sales_max ?? 10;
    const vinylMin = salesConfig.vinyl_base_sales_min ?? 1;
    const vinylMax = salesConfig.vinyl_base_sales_max ?? 6;
    const cassetteMin = salesConfig.cassette_base_sales_min ?? 1;
    const cassetteMax = salesConfig.cassette_base_sales_max ?? 4;
    const fameDivisor = salesConfig.fame_multiplier_divisor ?? 10000;
    const regionalFameWeight = salesConfig.regional_fame_weight ?? 1.0;
    const marketScarcityMinBands = salesConfig.market_scarcity_min_bands ?? 20;
    const marketScarcityMaxMultiplier = salesConfig.market_scarcity_max_multiplier ?? 5;
    const performedCountryBonus = salesConfig.performed_country_bonus ?? 1.2;
    
    console.log(`Sales config loaded: digital=${digitalMin}-${digitalMax}, fame divisor=${fameDivisor}`);

    const { data: releases, error: releasesError } = await supabaseClient
      .from("releases")
      .select(`
        id,
        band_id,
        user_id,
        release_type,
        bands(fame, popularity, chemistry_level, home_city_id),
        release_formats(id, format_type, retail_price, quantity),
        release_songs!release_songs_release_id_fkey(song_id, song:songs(id, quality_score))
      `)
      .eq("release_status", "released");

    if (releasesError) throw releasesError;

    const userIds = Array.from(
      new Set((releases || []).map((release) => release.user_id).filter(Boolean))
    );

    let profilesMap = new Map<string, { fame?: number; popularity?: number }>();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseClient
        .from("profiles")
        .select("id, fame, popularity")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      profilesMap = new Map(
        (profiles || []).map((profile) => [profile.id as string, profile])
      );
    }

    // Get active band count for market scaling
    const { count: activeBandCount } = await supabaseClient
      .from("bands")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");
    
    // Market scarcity bonus: fewer bands = more sales per release
    const marketMultiplier = Math.max(1, Math.min(marketScarcityMaxMultiplier, 100 / Math.max(activeBandCount || 100, marketScarcityMinBands)));
    console.log(`Market multiplier: ${marketMultiplier.toFixed(2)} (${activeBandCount} active bands)`);

    // Helper function to calculate regional sales multiplier
    function calculateRegionalSalesMultiplier(countryFame: number, hasPerformed: boolean, globalFame: number): number {
      // Base multiplier from country fame (0.5x to 2x) scaled by regional weight
      const countryBase = 0.5 + (countryFame / 10000) * 1.5 * regionalFameWeight;
      // Bonus for having performed in the country (configurable)
      const performedBonusMult = hasPerformed ? performedCountryBonus : 1.0;
      // Global fame provides a floor (never go below 0.3x of what global fame would give)
      const globalFloor = 0.3 + (globalFame / fameDivisor) * 0.7;
      return Math.max(countryBase * performedBonusMult, globalFloor);
    }

    for (const release of releases || []) {
      try {
        releasesProcessed += 1;

        const profile = release.user_id
          ? profilesMap.get(release.user_id as string)
          : undefined;

        const artistFame = release.bands?.[0]?.fame || profile?.fame || 0;
        const artistPopularity = release.bands?.[0]?.popularity || profile?.popularity || 0;

        // Fetch regional fame data for bands
        let regionalMultiplier = 1.0;
        if (release.band_id) {
          const { data: countryFans } = await supabaseClient
            .from("band_country_fans")
            .select("fame, has_performed, total_fans")
            .eq("band_id", release.band_id);
          
          if (countryFans && countryFans.length > 0) {
            // Calculate weighted global fame
            const totalFans = countryFans.reduce((sum, cf) => sum + (cf.total_fans || 0), 0);
            const globalFame = totalFans > 0 
              ? countryFans.reduce((sum, cf) => sum + (cf.fame || 0) * (cf.total_fans || 0), 0) / totalFans
              : artistFame;
            
            // Use home country fame for base sales calculation
            const homeCountryData = countryFans.find(cf => true); // Default to first entry
            const countryFame = homeCountryData?.fame || artistFame;
            const hasPerformed = homeCountryData?.has_performed || false;
            
            regionalMultiplier = calculateRegionalSalesMultiplier(countryFame, hasPerformed, globalFame);
          }
        }

        const avgQuality =
          (release.release_songs?.reduce(
            (sum: number, rs: any) => sum + (rs.song?.quality_score || 50),
            0
          ) ?? 50) / (release.release_songs?.length || 1);

        const fameMultiplier = 1 + artistFame / fameDivisor;
        const popularityMultiplier = 1 + artistPopularity / fameDivisor;
        const qualityMultiplier = avgQuality / 50;

        for (const format of release.release_formats || []) {
          // For physical formats, skip if no stock. For digital/streaming, always allow sales
          const isDigital = format.format_type === "digital" || format.format_type === "streaming";
          if (!isDigital && (!format.quantity || format.quantity <= 0)) continue;

          let baseSales = 0;

          switch (format.format_type) {
            case "digital":
              baseSales = digitalMin + Math.floor(Math.random() * (digitalMax - digitalMin));
              break;
            case "streaming":
              // Streaming doesn't generate direct sales, skip
              continue;
            case "cd":
              baseSales = cdMin + Math.floor(Math.random() * (cdMax - cdMin));
              break;
            case "vinyl":
              baseSales = vinylMin + Math.floor(Math.random() * (vinylMax - vinylMin));
              break;
            case "cassette":
              baseSales = cassetteMin + Math.floor(Math.random() * (cassetteMax - cassetteMin));
              break;
          }

          const calculatedSales = Math.floor(
            baseSales * fameMultiplier * popularityMultiplier * qualityMultiplier * marketMultiplier * regionalMultiplier
          );

          // For digital, no stock limit. For physical, cap at available stock
          const actualSales = isDigital ? calculatedSales : Math.min(calculatedSales, format.quantity || 0);

          if (actualSales > 0) {
            const revenue = actualSales * (format.retail_price || 0);

            await supabaseClient.from("release_sales").insert({
              release_format_id: format.id,
              quantity_sold: actualSales,
              unit_price: format.retail_price,
              total_amount: revenue,
              sale_date: new Date().toISOString().split("T")[0],
              platform: isDigital ? "digital_store" : "physical_store",
            });

            // Only decrement stock for physical formats
            if (!isDigital) {
              await supabaseClient
                .from("release_formats")
                .update({ quantity: (format.quantity || 0) - actualSales })
                .eq("id", format.id);
            }

            await supabaseClient.rpc("increment_release_revenue", {
              release_id: release.id,
              amount: revenue,
            });

            if (release.band_id) {
              await supabaseClient.from("band_earnings").insert({
                band_id: release.band_id,
                amount: revenue,
                source: "release_sales",
                description: `Daily sales revenue`,
                metadata: { format: format.format_type, units: actualSales },
              });
            }

            // Update song fame based on sales (1 fame per 5 physical sales, 1 per 10 digital)
            const famePerSale = isDigital ? 0.1 : 0.2;
            for (const rs of release.release_songs || []) {
              if (rs.song_id) {
                const fameGain = Math.floor(actualSales * famePerSale);
                if (fameGain > 0) {
                  await supabaseClient.rpc('update_song_fame', {
                    p_song_id: rs.song_id,
                    p_fame_amount: fameGain,
                    p_source: 'sales'
                  });
                }
              }
            }

            totalSales += actualSales;
          }
        }
      } catch (releaseError) {
        errorCount += 1;
        console.error(`Error processing release ${release.id}:`, releaseError);
      }
    }

    console.log(`Generated ${totalSales} total sales across all releases`);

    await completeJobRun({
      jobName: "generate-daily-sales",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount: releasesProcessed,
      errorCount,
      resultSummary: {
        releasesProcessed,
        totalSales,
        errorCount,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        totalSales,
        releasesProcessed,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await failJobRun({
      jobName: "generate-daily-sales",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: {
        totalSales,
        releasesProcessed,
        errorCount,
      },
    });

    console.error("Error generating sales:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
