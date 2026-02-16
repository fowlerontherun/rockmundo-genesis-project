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
    
    // Distribution & tax config
    const digitalDistributionRate = (salesConfig.digital_distribution_rate ?? 30) / 100;
    const cdDistributionRate = (salesConfig.cd_distribution_rate ?? 20) / 100;
    const vinylDistributionRate = (salesConfig.vinyl_distribution_rate ?? 15) / 100;
    const cassetteDistributionRate = (salesConfig.cassette_distribution_rate ?? 15) / 100;
    const defaultSalesTaxRate = (salesConfig.default_sales_tax_rate ?? 10) / 100;
    
    console.log(`Sales config loaded: digital=${digitalMin}-${digitalMax}, fame divisor=${fameDivisor}`);
    console.log(`Distribution rates: digital=${digitalDistributionRate*100}%, cd=${cdDistributionRate*100}%, vinyl=${vinylDistributionRate*100}%`);
    console.log(`Default tax rate: ${defaultSalesTaxRate*100}%`);

    // ── Christmas Sales Boost (fixed epoch: Jan 1, 2026) ──
    const GAME_EPOCH = new Date("2026-01-01T00:00:00Z");
    const msFromEpoch = Date.now() - GAME_EPOCH.getTime();
    const realDaysFromEpoch = Math.max(0, Math.floor(msFromEpoch / (1000 * 60 * 60 * 24)));
    const daysPerGameMonth = 10;
    const gameDaysElapsed = Math.floor((realDaysFromEpoch / daysPerGameMonth) * 30);
    const remainingGameDays = gameDaysElapsed % 360;
    const currentGameMonth = Math.floor(remainingGameDays / 30) + 1;
    const currentGameDay = (remainingGameDays % 30) + 1;
    const currentGameYear = Math.floor(gameDaysElapsed / 360) + 1;

    let christmasMultiplier = 1.0;
    const christmasBoostBase = salesConfig.christmas_sales_boost ?? 1.5;
    if (currentGameMonth === 12) {
      if (currentGameDay === 25) {
        christmasMultiplier = christmasBoostBase + 1.0; // 2.5x default
      } else if (currentGameDay >= 20) {
        christmasMultiplier = christmasBoostBase + 0.5; // 2.0x default
      } else {
        christmasMultiplier = christmasBoostBase; // 1.5x default
      }
    }
    console.log(`Game date: Month ${currentGameMonth}, Day ${currentGameDay}, Year ${currentGameYear} | Christmas multiplier: ${christmasMultiplier}x`);

    const { data: releases, error: releasesError } = await supabaseClient
      .from("releases")
      .select(`
        id,
        band_id,
        user_id,
        release_type,
        hype_score,
        manufacturing_complete_at,
        bands(id, fame, popularity, chemistry_level, home_city_id),
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

    // Helper to get distribution rate by format
    function getDistributionRate(formatType: string): number {
      switch (formatType) {
        case "digital": return digitalDistributionRate;
        case "cd": return cdDistributionRate;
        case "vinyl": return vinylDistributionRate;
        case "cassette": return cassetteDistributionRate;
        default: return 0.25; // default 25%
      }
    }

    // Helper to get city sales tax rate
    async function getCitySalesTaxRate(cityId: string | null): Promise<number> {
      if (!cityId) return defaultSalesTaxRate;
      
      const { data: cityLaws } = await supabaseClient
        .from("city_laws")
        .select("sales_tax_rate")
        .eq("city_id", cityId)
        .is("effective_until", null)
        .maybeSingle();
      
      if (cityLaws?.sales_tax_rate != null) {
        return cityLaws.sales_tax_rate / 100;
      }
      return defaultSalesTaxRate;
    }

    for (const release of releases || []) {
      try {
        releasesProcessed += 1;

        const profile = release.user_id
          ? profilesMap.get(release.user_id as string)
          : undefined;

        const band = release.bands?.[0];
        const artistFame = band?.fame || profile?.fame || 0;
        const artistPopularity = band?.popularity || profile?.popularity || 0;
        const homeCityId = band?.home_city_id || null;

        // Get city sales tax rate
        const salesTaxRate = await getCitySalesTaxRate(homeCityId);

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

        // Logarithmic fame scaling: fame 100→1.5x, 1K→2x, 10K→3x, 100K→3.5x, 1M→4x, 5M→4.3x
        const fameMultiplier = 1 + Math.log10(Math.max(artistFame, 1)) * 0.5;
        const popularityMultiplier = 1 + Math.log10(Math.max(artistPopularity, 1)) * 0.3;
        const qualityMultiplier = 0.5 + (avgQuality / 100) * 1.0; // 0.5x at 0 quality, 1.5x at 100

        for (const format of release.release_formats || []) {
          // Skip formats with no retail price set
          const retailPrice = format.retail_price || 0;
          if (retailPrice <= 0) continue;
          
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

          // Hype multiplier: 0 hype = 1.0x, 500 hype = 2.0x, 1000 hype = 3.0x
          const hypeScore = (release as any).hype_score || 0;
          const hypeMultiplier = 1 + (hypeScore / 500);
          const releasedDate = (release as any).manufacturing_complete_at || release.created_at;
          const daysSinceRelease = releasedDate ? (Date.now() - new Date(releasedDate).getTime()) / (1000 * 60 * 60 * 24) : 999;
          const firstWeekBoost = daysSinceRelease <= 7 ? 1.5 : 1.0;

          const calculatedSales = Math.floor(
            baseSales * fameMultiplier * popularityMultiplier * qualityMultiplier * marketMultiplier * regionalMultiplier * hypeMultiplier * firstWeekBoost * christmasMultiplier
          );

          // For digital, no stock limit. For physical, cap at available stock
          const actualSales = isDigital ? calculatedSales : Math.min(calculatedSales, format.quantity || 0);

          if (actualSales > 0) {
            // retail_price is stored in CENTS — convert to dollars for revenue calc
            const retailPriceDollars = retailPrice / 100;
            const grossRevenue = Math.round(actualSales * retailPriceDollars * 100) / 100;
            
            // Calculate tax and distribution deductions
            const distributionRate = getDistributionRate(format.format_type);
            const salesTaxAmount = Math.round(grossRevenue * salesTaxRate * 100) / 100;
            const distributionFee = Math.round(grossRevenue * distributionRate * 100) / 100;
            const netRevenue = grossRevenue - salesTaxAmount - distributionFee;
            
            // Store in cents in release_sales
            const unitPriceCents = retailPrice; // already in cents
            const totalAmountCents = Math.round(grossRevenue * 100);
            const salesTaxCents = Math.round(salesTaxAmount * 100);
            const distributionFeeCents = Math.round(distributionFee * 100);
            const netRevenueCents = Math.round(netRevenue * 100);

            await supabaseClient.from("release_sales").insert({
              release_format_id: format.id,
              quantity_sold: actualSales,
              unit_price: unitPriceCents,
              total_amount: totalAmountCents,
              sale_date: new Date().toISOString().split("T")[0],
              platform: isDigital ? "digital_store" : "physical_store",
              // New tax/distribution columns
              sales_tax_amount: salesTaxCents,
              sales_tax_rate: salesTaxRate * 100,
              distribution_fee: distributionFeeCents,
              distribution_rate: distributionRate * 100,
              net_revenue: netRevenueCents,
              city_id: homeCityId,
            });

            // Only decrement stock for physical formats
            if (!isDigital) {
              await supabaseClient
                .from("release_formats")
                .update({ quantity: (format.quantity || 0) - actualSales })
                .eq("id", format.id);
            }

            // Update release revenue with GROSS (in dollars for display)
            await supabaseClient.rpc("increment_release_revenue", {
              release_id: release.id,
              amount: grossRevenue,
            });

            // Update per-format and total unit counters on release
            const formatColumn = format.format_type === "digital" ? "digital_sales" 
              : format.format_type === "cd" ? "cd_sales"
              : format.format_type === "vinyl" ? "vinyl_sales"
              : format.format_type === "cassette" ? "cassette_sales"
              : null;
            
            if (formatColumn) {
              const updateObj: Record<string, any> = {};
              // Fetch current values to increment
              const { data: currentRelease } = await supabaseClient
                .from("releases")
                .select(`total_units_sold, ${formatColumn}`)
                .eq("id", release.id)
                .single();
              
              if (currentRelease) {
                updateObj.total_units_sold = (currentRelease.total_units_sold || 0) + actualSales;
                updateObj[formatColumn] = (currentRelease[formatColumn] || 0) + actualSales;
                await supabaseClient.from("releases").update(updateObj).eq("id", release.id);
              }
            }

            // Credit NET revenue to band (after tax + distribution)
            if (release.band_id) {
              await supabaseClient.from("band_earnings").insert({
                band_id: release.band_id,
                amount: netRevenue,
                source: "release_sales",
                description: `Daily sales revenue (after ${Math.round(salesTaxRate * 100)}% tax + ${Math.round(distributionRate * 100)}% distribution)`,
                metadata: { 
                  format: format.format_type, 
                  units: actualSales,
                  gross_revenue: grossRevenue,
                  sales_tax: salesTaxAmount,
                  sales_tax_rate: salesTaxRate * 100,
                  distribution_fee: distributionFee,
                  distribution_rate: distributionRate * 100,
                  net_revenue: netRevenue,
                  city_id: homeCityId,
                },
              });

              // Update band_balance with net revenue
              const { data: currentBand } = await supabaseClient
                .from("bands")
                .select("band_balance")
                .eq("id", release.band_id)
                .single();

              if (currentBand) {
                await supabaseClient
                  .from("bands")
                  .update({ band_balance: (currentBand.band_balance || 0) + netRevenue })
                  .eq("id", release.band_id);
              }
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
        // Hype decay: 5% per day after first week
        const hypeScoreVal = (release as any).hype_score || 0;
        const releaseDateVal = (release as any).manufacturing_complete_at || release.created_at;
        const daysSinceVal = releaseDateVal ? (Date.now() - new Date(releaseDateVal).getTime()) / (1000 * 60 * 60 * 24) : 999;
        if (daysSinceVal > 7 && hypeScoreVal > 0) {
          const decayedHype = Math.floor(hypeScoreVal * 0.95);
          await supabaseClient.from("releases")
            .update({ hype_score: decayedHype } as any)
            .eq("id", release.id);
        }

        // Apply active campaign hype boosts
        const { data: activeCampaigns } = await (supabaseClient.from("promotional_campaigns" as any) as any)
          .select("effects")
          .eq("release_id", release.id)
          .eq("status", "active");
        
        if (activeCampaigns && activeCampaigns.length > 0) {
          let campaignHypeBoost = 0;
          for (const campaign of activeCampaigns) {
            campaignHypeBoost += (campaign.effects?.hypeBoost || 0);
          }
          if (campaignHypeBoost > 0) {
            const currentHype = (release as any).hype_score || 0;
            const newHype = Math.min(1000, currentHype + campaignHypeBoost);
            await supabaseClient.from("releases")
              .update({ hype_score: newHype } as any)
              .eq("id", release.id);
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
