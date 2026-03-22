import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

// Helper: get sales tax rate for a city
async function getCitySalesTaxRate(cityId: string | null, client?: any): Promise<number> {
  if (!cityId || !client) return 0.10;
  try {
    const { data } = await client
      .from("cities")
      .select("sales_tax_rate")
      .eq("id", cityId)
      .single();
    return data?.sales_tax_rate != null ? data.sales_tax_rate / 100 : 0.10;
  } catch {
    return 0.10;
  }
}

// Helper: get distribution rate by format type
function getDistributionRate(formatType: string): number {
  switch (formatType) {
    case "digital": return 0.30;
    case "cd": return 0.20;
    case "vinyl": return 0.15;
    case "cassette": return 0.15;
    default: return 0.20;
  }
}

// Helper: calculate regional sales multiplier based on country fame
function calculateRegionalSalesMultiplier(
  countryFame: number,
  hasPerformed: boolean,
  globalFame: number
): number {
  let baseMultiplier = 0.1 + (Math.min(countryFame, 1000) / 1000) * 0.9;
  if (!hasPerformed && countryFame <= 100) {
    baseMultiplier = Math.min(baseMultiplier, 0.3);
  }
  const globalFloor = 0.05 + (Math.min(globalFame, 10000) / 10000) * 0.2;
  return Math.max(baseMultiplier, globalFloor);
}

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

  // Accumulate per-band revenue to credit once at the end
  const bandRevenueAccumulator = new Map<string, { netRevenue: number; grossRevenue: number; units: number; taxRate: number; formats: string[] }>();

  // Accumulate per-label revenue for label splits
  const labelRevenueAccumulator = new Map<string, { labelRevenue: number; recoupmentApplied: number; contractId: string }>();

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
        christmasMultiplier = christmasBoostBase + 1.0;
      } else if (currentGameDay >= 20) {
        christmasMultiplier = christmasBoostBase + 0.5;
      } else {
        christmasMultiplier = christmasBoostBase;
      }
    }
    console.log(`Game date: Month ${currentGameMonth}, Day ${currentGameDay}, Year ${currentGameYear} | Christmas multiplier: ${christmasMultiplier}x`);

    const { data: releases, error: releasesError } = await supabaseClient
      .from("releases")
      .select(`
        id,
        band_id,
        user_id,
        created_at,
        release_type,
        hype_score,
        manufacturing_complete_at,
        home_country,
        label_contract_id,
        label_revenue_share_pct,
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
    
    const marketMultiplier = Math.max(1, Math.min(marketScarcityMaxMultiplier, 100 / Math.max(activeBandCount || 100, marketScarcityMinBands)));
    console.log(`Market multiplier: ${marketMultiplier.toFixed(2)} (${activeBandCount} active bands)`);

    // Pre-fetch all release territories
    const releaseIds = (releases || []).map(r => r.id);
    let allTerritories: any[] = [];
    if (releaseIds.length > 0) {
      const { data: territories } = await supabaseClient
        .from("release_territories")
        .select("release_id, country, distance_tier, cost_multiplier, is_active")
        .in("release_id", releaseIds)
        .eq("is_active", true);
      allTerritories = territories || [];
    }

    // Pre-fetch all active label contracts for revenue splitting
    const contractIds = [...new Set((releases || []).map(r => (r as any).label_contract_id).filter(Boolean))];
    const contractMap = new Map<string, { id: string; label_id: string; advance_amount: number; recouped_amount: number; royalty_artist_pct: number; royalty_label_pct: number; marketing_support: number; deal_type_name: string; end_date: string }>();
    
    if (contractIds.length > 0) {
      const { data: contracts } = await supabaseClient
        .from("artist_label_contracts")
        .select("id, label_id, advance_amount, recouped_amount, royalty_artist_pct, royalty_label_pct, marketing_support, status, deal_type_id, end_date")
        .in("id", contractIds)
        .eq("status", "active");
      
      // Pre-fetch deal type names
      const dealTypeIds = [...new Set((contracts || []).map(c => c.deal_type_id).filter(Boolean))];
      const dealTypeNameMap = new Map<string, string>();
      if (dealTypeIds.length > 0) {
        const { data: dealTypes } = await supabaseClient
          .from("label_deal_types")
          .select("id, name")
          .in("id", dealTypeIds);
        for (const dt of dealTypes || []) {
          dealTypeNameMap.set(dt.id, dt.name);
        }
      }
      
      for (const c of contracts || []) {
        const dealTypeName = dealTypeNameMap.get(c.deal_type_id) || "Standard Deal";
        contractMap.set(c.id, {
          id: c.id,
          label_id: c.label_id,
          advance_amount: c.advance_amount ?? 0,
          recouped_amount: c.recouped_amount ?? 0,
          royalty_artist_pct: c.royalty_artist_pct,
          royalty_label_pct: c.royalty_label_pct ?? (100 - c.royalty_artist_pct),
          marketing_support: c.marketing_support ?? 0,
          deal_type_name: dealTypeName,
          end_date: c.end_date,
        });
      }
      console.log(`Loaded ${contractMap.size} active label contracts for revenue splitting`);
    }

    // Region adjacency for spillover
    const regionAdjacency: Record<string, string[]> = {
      "Europe": ["Middle East", "Africa"],
      "Middle East": ["Europe", "Asia", "Africa"],
      "Africa": ["Europe", "Middle East"],
      "North America": ["Central America", "Caribbean", "South America"],
      "Central America": ["North America", "South America", "Caribbean"],
      "Caribbean": ["North America", "Central America", "South America"],
      "South America": ["North America", "Central America", "Caribbean"],
      "Asia": ["Oceania", "Middle East", "South East Asia"],
      "South East Asia": ["Asia", "Oceania"],
      "Oceania": ["Asia", "South East Asia"],
    };

    // === PRE-FETCH BAND SENTIMENT FOR SALES MODIFIER (v1.0.986) ===
    const saleBandIds = [...new Set((releases || []).map(r => r.band_id).filter(Boolean))];
    let bandSentimentSalesMap = new Map<string, number>();
    if (saleBandIds.length > 0) {
      const { data: bandSentData } = await supabaseClient
        .from('bands')
        .select('id, fan_sentiment_score')
        .in('id', saleBandIds);
      for (const b of bandSentData || []) {
        bandSentimentSalesMap.set(b.id, (b as any).fan_sentiment_score ?? 0);
      }
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
        const salesTaxRate = await getCitySalesTaxRate(homeCityId, supabaseClient);

        // Get territories for this release
        const releaseTerritories = allTerritories.filter(t => t.release_id === release.id);
        const hasTerritories = releaseTerritories.length > 0;

        // Fetch ALL country fans for this band
        let countryFansMap = new Map<string, { fame: number; has_performed: boolean; total_fans: number }>();
        let globalFame = artistFame;
        
        if (release.band_id) {
          const { data: countryFans } = await supabaseClient
            .from("band_country_fans")
            .select("country, fame, has_performed, total_fans")
            .eq("band_id", release.band_id);
          
          if (countryFans && countryFans.length > 0) {
            for (const cf of countryFans) {
              countryFansMap.set(cf.country, cf);
            }
            const totalFans = countryFans.reduce((sum, cf) => sum + (cf.total_fans || 0), 0);
            globalFame = totalFans > 0 
              ? countryFans.reduce((sum, cf) => sum + (cf.fame || 0) * (cf.total_fans || 0), 0) / totalFans
              : artistFame;
          }
        }

        // If no territories, use legacy global logic
        let regionalMultiplier = 1.0;
        if (!hasTerritories) {
          const firstEntry = countryFansMap.values().next().value;
          if (firstEntry) {
            regionalMultiplier = calculateRegionalSalesMultiplier(firstEntry.fame, firstEntry.has_performed, globalFame);
          }
        }

        const avgQuality =
          (release.release_songs?.reduce(
            (sum: number, rs: any) => sum + (rs.song?.quality_score || 50),
            0
          ) ?? 50) / (release.release_songs?.length || 1);

        // Squared-log fame scaling (v1.1.031 — capped to prevent runaway values)
        // Cap fame/pop multipliers to prevent extreme compounding at high fame (25M+)
        const logFame = Math.log10(Math.max(artistFame, 1));
        const fameMultiplier = 1 + Math.min(Math.pow(logFame, 2) * 0.5, 30);
        const logPop = Math.log10(Math.max(artistPopularity, 1));
        const popularityMultiplier = 1 + Math.min(Math.pow(logPop, 2) * 0.3, 20);
        const qualityMultiplier = 0.5 + (avgQuality / 100) * 1.0;
        const totalFans = countryFansMap.size > 0 
          ? Array.from(countryFansMap.values()).reduce((sum, cf) => sum + (cf.total_fans || 0), 0)
          : 0;
        // Old: sqrt(500K)*0.005 = 3.5x. New: log10-based with cap — 1K→4x, 100K→6x, 1M→7x
        const fansMultiplier = totalFans > 0 ? 1 + Math.min(Math.log10(totalFans) * 1.5, 10) : 1.0;

        // ── Label contract lookup for this release ──
        const releaseContractId = (release as any).label_contract_id;
        const releaseSharePct = (release as any).label_revenue_share_pct;
        const contract = releaseContractId ? contractMap.get(releaseContractId) : null;
        // Effective label cut percentage (from release override or contract)
        const labelCutPct = contract
          ? (releaseSharePct ?? contract.royalty_label_pct) / 100
          : 0;

        for (const format of release.release_formats || []) {
          const retailPrice = format.retail_price || 0;
          if (retailPrice <= 0) continue;
          
          const isDigital = format.format_type === "digital" || format.format_type === "streaming";
          if (!isDigital && (!format.quantity || format.quantity <= 0)) continue;

          let baseSales = 0;

          switch (format.format_type) {
            case "digital":
              baseSales = digitalMin + Math.floor(Math.random() * (digitalMax - digitalMin));
              break;
            case "streaming":
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

          const hypeScore = (release as any).hype_score || 0;
          const hypeMultiplier = 1 + (hypeScore / 500);
          const releasedDate = (release as any).manufacturing_complete_at || release.created_at;
          const realDaysSinceRelease = releasedDate ? (Date.now() - new Date(releasedDate).getTime()) / (1000 * 60 * 60 * 24) : 999;
          const gameDaysSinceRelease = realDaysSinceRelease * 3;
          const ageDecay = gameDaysSinceRelease <= 7 ? 1.5
            : gameDaysSinceRelease <= 14 ? 1.2
            : gameDaysSinceRelease <= 30 ? 1.0
            : gameDaysSinceRelease <= 60 ? 0.7
            : gameDaysSinceRelease <= 90 ? 0.5
            : gameDaysSinceRelease <= 180 ? 0.35
            : gameDaysSinceRelease <= 360 ? 0.2
            : 0.1;

          // Label marketing support bonus: adds hype-like multiplier
          const labelMarketingBonus = contract ? 1 + (contract.marketing_support / 10000) : 1.0;

          const territoriesToProcess = hasTerritories 
            ? releaseTerritories 
            : [{ country: null, distance_tier: 'domestic', cost_multiplier: 1.0 }];

          for (const territory of territoriesToProcess) {
            let territoryRegionalMult = regionalMultiplier;
            if (hasTerritories && territory.country) {
              const countryData = countryFansMap.get(territory.country);
              const countryFame = countryData?.fame || 0;
              const hasPerformed = countryData?.has_performed || false;
              territoryRegionalMult = calculateRegionalSalesMultiplier(countryFame, hasPerformed, globalFame);
              territoryRegionalMult *= (1 / Math.sqrt(territory.cost_multiplier || 1));
            }

            // === FAN SENTIMENT → DAILY SALES (v1.0.986) ===
            // Positive fan sentiment drives more purchases; negative sentiment suppresses sales
            const salesSentiment = release.band_id ? (bandSentimentSalesMap.get(release.band_id) ?? 0) : 0;
            const salesSentT = (Math.max(-100, Math.min(100, salesSentiment)) + 100) / 200;
            const salesSentMod = parseFloat((0.7 + salesSentT * 0.6).toFixed(2)); // 0.7x–1.3x

            const calculatedSales = Math.floor(
              baseSales * fameMultiplier * popularityMultiplier * qualityMultiplier * fansMultiplier * marketMultiplier * territoryRegionalMult * hypeMultiplier * ageDecay * christmasMultiplier * labelMarketingBonus * salesSentMod
              / (hasTerritories ? Math.max(1, releaseTerritories.length * 0.5) : 1)
            );

            const actualSales = isDigital ? calculatedSales : Math.min(calculatedSales, format.quantity || 0);

            if (actualSales > 0) {
              const retailPriceDollars = retailPrice / 100;
              const grossRevenue = Math.round(actualSales * retailPriceDollars * 100) / 100;
              
              const distributionRate = getDistributionRate(format.format_type);
              const salesTaxAmount = Math.round(grossRevenue * salesTaxRate * 100) / 100;
              const distributionFee = Math.round(grossRevenue * distributionRate * 100) / 100;
              const netRevenue = grossRevenue - salesTaxAmount - distributionFee;
              
              const unitPriceCents = retailPrice;
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
                sales_tax_amount: salesTaxCents,
                sales_tax_rate: salesTaxRate * 100,
                distribution_fee: distributionFeeCents,
                distribution_rate: distributionRate * 100,
                net_revenue: netRevenueCents,
                city_id: homeCityId,
                country: territory.country || null,
              });

              if (!isDigital) {
                await supabaseClient
                  .from("release_formats")
                  .update({ quantity: (format.quantity || 0) - actualSales })
                  .eq("id", format.id);
              }

              await supabaseClient.rpc("increment_release_revenue", {
                release_id: release.id,
                amount: grossRevenue,
              });

              const formatColumn = format.format_type === "digital" ? "digital_sales" 
                : format.format_type === "cd" ? "cd_sales"
                : format.format_type === "vinyl" ? "vinyl_sales"
                : format.format_type === "cassette" ? "cassette_sales"
                : null;
              
              if (formatColumn) {
                const updateObj: Record<string, any> = {};
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

              // ── Label Revenue Split (Deal-Type Aware) ──
              // Distribution Deal: only takes cut on physical/digital sales (not streaming, which is handled in update-daily-streams)
              // Licensing Deal: check if contract has expired — if so, skip label cut
              // Production Deal: label takes recording revenue cut (sales are recording revenue)
              // Standard Deal: normal recording sales split
              // 360 Deal: takes cut of everything (gig/merch handled separately in complete-gig/simulate-merch-sales)
              const dealType = contract?.deal_type_name || "Standard Deal";
              
              // Licensing Deal: if contract end date has passed, no label cut
              const isLicensingExpired = dealType === "Licensing Deal" && contract && new Date(contract.end_date) < new Date();
              
              // All deal types get a cut of sales revenue (it's recording/distribution revenue)
              // Distribution Deal gets a smaller effective cut (only distribution margin)
              let effectiveLabelCutPct = labelCutPct;
              if (dealType === "Distribution Deal") {
                // Distribution deals only take the distribution margin, not full royalty
                effectiveLabelCutPct = Math.min(labelCutPct, 0.20); // cap at 20%
              }
              
              if (contract && effectiveLabelCutPct > 0 && release.band_id && !isLicensingExpired) {
                const labelShareDollars = netRevenue * effectiveLabelCutPct;
                const bandShareDollars = netRevenue * (1 - effectiveLabelCutPct);

                // Check if advance still needs recoupment
                const currentRecouped = contract.recouped_amount;
                const advanceRemaining = Math.max(0, contract.advance_amount - currentRecouped);
                
                let recoupmentFromThisSale = 0;
                let labelFinalShare = labelShareDollars;
                let bandFinalShare = bandShareDollars;

                if (advanceRemaining > 0) {
                  // During recoupment: label takes their full share as recoupment
                  recoupmentFromThisSale = Math.min(labelShareDollars, advanceRemaining);
                  // Label keeps their share (it goes to recoup the advance)
                  labelFinalShare = labelShareDollars;
                  bandFinalShare = bandShareDollars;
                }

                // Accumulate label revenue
                const labelKey = `${contract.label_id}:${contract.id}`;
                const existing = labelRevenueAccumulator.get(labelKey) || { labelRevenue: 0, recoupmentApplied: 0, contractId: contract.id };
                existing.labelRevenue += labelFinalShare;
                existing.recoupmentApplied += recoupmentFromThisSale;
                labelRevenueAccumulator.set(labelKey, existing);

                // Update in-memory recouped amount so subsequent iterations are correct
                contract.recouped_amount += recoupmentFromThisSale;

                // Accumulate band's share (reduced by label cut)
                const bandExisting = bandRevenueAccumulator.get(release.band_id) || { netRevenue: 0, grossRevenue: 0, units: 0, taxRate: salesTaxRate, formats: [] };
                bandExisting.netRevenue += bandFinalShare;
                bandExisting.grossRevenue += grossRevenue;
                bandExisting.units += actualSales;
                if (!bandExisting.formats.includes(format.format_type)) {
                  bandExisting.formats.push(format.format_type);
                }
                bandRevenueAccumulator.set(release.band_id, bandExisting);
              } else {
                // No label contract — 100% to band
                if (release.band_id) {
                  const existing = bandRevenueAccumulator.get(release.band_id) || { netRevenue: 0, grossRevenue: 0, units: 0, taxRate: salesTaxRate, formats: [] };
                  existing.netRevenue += netRevenue;
                  existing.grossRevenue += grossRevenue;
                  existing.units += actualSales;
                  if (!existing.formats.includes(format.format_type)) {
                    existing.formats.push(format.format_type);
                  }
                  bandRevenueAccumulator.set(release.band_id, existing);
                }
              }

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
          } // end territory loop
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

    // ── Batch credit all bands with accumulated revenue ──
    let bandsCredited = 0;
    for (const [bandId, revenue] of bandRevenueAccumulator.entries()) {
      if (revenue.netRevenue <= 0) continue;

      try {
        const netAmount = Math.round(revenue.netRevenue);

        const { error: earningsError } = await supabaseClient
          .from("band_earnings")
          .insert({
            band_id: bandId,
            amount: netAmount,
            source: "release_sales",
            description: `Daily sales revenue: ${revenue.units} units across ${revenue.formats.join(", ")} (net after tax, distribution & label split)`,
            metadata: {
              gross_revenue: Math.round(revenue.grossRevenue * 100) / 100,
              net_revenue: netAmount,
              total_units: revenue.units,
              formats: revenue.formats,
            },
          });

        if (earningsError) {
          console.error(`Failed to insert band_earnings for band ${bandId}:`, earningsError);
          errorCount++;
          continue;
        }

        const { data: currentBand, error: fetchError } = await supabaseClient
          .from("bands")
          .select("band_balance, morale")
          .eq("id", bandId)
          .single();

        if (fetchError) {
          console.error(`Failed to fetch band_balance for band ${bandId}:`, fetchError);
          errorCount++;
          continue;
        }

        // === DAILY SALES → MORALE (v1.0.977) ===
        // Earning money from sales feels rewarding
        const curMorale = (currentBand as any).morale ?? 50;
        const moraleBoost = netAmount >= 1000 ? 3 : netAmount >= 200 ? 2 : netAmount > 0 ? 1 : 0;
        const newMorale = moraleBoost > 0 ? Math.min(100, curMorale + moraleBoost) : curMorale;

        const newBalance = (currentBand?.band_balance || 0) + netAmount;
        const updatePayload: any = { band_balance: newBalance };
        if (moraleBoost > 0) {
          updatePayload.morale = newMorale;
          console.log(`Daily sales morale: $${netAmount} revenue → morale +${moraleBoost} for band ${bandId}`);
        }
        const { error: updateError } = await supabaseClient
          .from("bands")
          .update(updatePayload)
          .eq("id", bandId);

        if (updateError) {
          console.error(`Failed to update band_balance for band ${bandId}:`, updateError);
          errorCount++;
          continue;
        }

        bandsCredited++;
        console.log(`Credited band ${bandId}: $${netAmount} (${revenue.units} units)`);
      } catch (creditError) {
        console.error(`Error crediting band ${bandId}:`, creditError);
        errorCount++;
      }
    }
    console.log(`Credited ${bandsCredited}/${bandRevenueAccumulator.size} bands with sales revenue`);

    // ── Batch credit all labels with accumulated revenue + update recoupment ──
    let labelsCredited = 0;
    for (const [labelKey, labelRevenue] of labelRevenueAccumulator.entries()) {
      if (labelRevenue.labelRevenue <= 0) continue;

      try {
        const [labelId] = labelKey.split(":");
        const labelAmount = Math.round(labelRevenue.labelRevenue);
        const recoupAmount = Math.round(labelRevenue.recoupmentApplied);

        // Credit label balance
        const { data: currentLabel } = await supabaseClient
          .from("labels")
          .select("balance")
          .eq("id", labelId)
          .single();

        if (currentLabel) {
          await supabaseClient
            .from("labels")
            .update({ balance: (currentLabel.balance || 0) + labelAmount })
            .eq("id", labelId);
        }

        // Record label financial transaction
        await supabaseClient.from("label_financial_transactions").insert({
          label_id: labelId,
          transaction_type: "revenue",
          amount: labelAmount,
          description: `Daily sales royalty share${recoupAmount > 0 ? ` (includes $${recoupAmount} advance recoupment)` : ''}`,
          related_contract_id: labelRevenue.contractId,
        });

        // Update contract recouped_amount in database
        if (recoupAmount > 0) {
          const { data: currentContract } = await supabaseClient
            .from("artist_label_contracts")
            .select("recouped_amount")
            .eq("id", labelRevenue.contractId)
            .single();

          if (currentContract) {
            await supabaseClient
              .from("artist_label_contracts")
              .update({ recouped_amount: (currentContract.recouped_amount || 0) + recoupAmount })
              .eq("id", labelRevenue.contractId);
          }
        }

        labelsCredited++;
        console.log(`Credited label ${labelId}: $${labelAmount} (recouped: $${recoupAmount})`);
      } catch (labelError) {
        console.error(`Error crediting label ${labelKey}:`, labelError);
        errorCount++;
      }
    }
    console.log(`Credited ${labelsCredited} labels with royalty revenue`);

    // ── Label Daily Marketing Budget → Hype Boost ──
    // Labels with a weekly_marketing_budget automatically promote releases of signed artists
    let labelsMarketingProcessed = 0;
    try {
      const { data: labelsWithBudget } = await supabaseClient
        .from("labels")
        .select("id, weekly_marketing_budget, balance")
        .gt("weekly_marketing_budget", 0)
        .eq("is_bankrupt", false);

      if (labelsWithBudget && labelsWithBudget.length > 0) {
        for (const lbl of labelsWithBudget) {
          try {
            const weeklyBudget = (lbl as any).weekly_marketing_budget || 0;
            const dailySpend = Math.round(weeklyBudget / 7);
            if (dailySpend <= 0) continue;

            // Check if label can afford
            if ((lbl.balance || 0) < dailySpend) {
              console.log(`Label ${lbl.id} cannot afford daily marketing spend of $${dailySpend}`);
              continue;
            }

            // Find active contracts for this label
            const { data: activeContracts } = await supabaseClient
              .from("artist_label_contracts")
              .select("id, band_id, artist_profile_id")
              .eq("label_id", lbl.id)
              .eq("status", "active");

            if (!activeContracts || activeContracts.length === 0) continue;

            // Find releases from signed artists (released within last 60 days or upcoming)
            const bandIds = activeContracts.map(c => c.band_id).filter(Boolean);
            if (bandIds.length === 0) continue;

            const { data: eligibleReleases } = await supabaseClient
              .from("releases")
              .select("id, hype_score, band_id, release_status, manufacturing_complete_at")
              .in("band_id", bandIds)
              .in("release_status", ["released", "manufacturing"]);

            if (!eligibleReleases || eligibleReleases.length === 0) continue;

            // Filter: only releases within 90 days of manufacturing completion (or still manufacturing)
            const now = Date.now();
            const recentReleases = eligibleReleases.filter(r => {
              if (r.release_status === "manufacturing") return true;
              if (r.manufacturing_complete_at) {
                const daysSince = (now - new Date(r.manufacturing_complete_at).getTime()) / (1000 * 60 * 60 * 24);
                return daysSince <= 90;
              }
              return false;
            });

            if (recentReleases.length === 0) continue;

            // Distribute daily spend across eligible releases
            const perReleaseSpend = dailySpend / recentReleases.length;
            // Hype gained: $100 spend = ~1 hype point, diminishing returns
            const hypePerRelease = Math.min(50, Math.round(Math.sqrt(perReleaseSpend / 10)));

            for (const rel of recentReleases) {
              const currentHype = (rel as any).hype_score || 0;
              const newHype = Math.min(1000, currentHype + hypePerRelease);
              await supabaseClient.from("releases")
                .update({ hype_score: newHype } as any)
                .eq("id", rel.id);
            }

            // Deduct from label balance
            await supabaseClient
              .from("labels")
              .update({ balance: (lbl.balance || 0) - dailySpend })
              .eq("id", lbl.id);

            // Record transaction
            await supabaseClient.from("label_financial_transactions").insert({
              label_id: lbl.id,
              transaction_type: "marketing",
              amount: dailySpend,
              description: `Daily marketing spend: ${recentReleases.length} releases boosted (+${hypePerRelease} hype each)`,
            });

            labelsMarketingProcessed++;
            console.log(`Label ${lbl.id}: spent $${dailySpend} marketing ${recentReleases.length} releases (+${hypePerRelease} hype each)`);
          } catch (labelMarketError) {
            console.error(`Error processing marketing for label ${lbl.id}:`, labelMarketError);
            errorCount++;
          }
        }
      }
    } catch (marketingError) {
      console.error("Error processing label marketing budgets:", marketingError);
      errorCount++;
    }
    console.log(`Processed marketing for ${labelsMarketingProcessed} labels`);

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
        bandsCredited,
        labelsCredited,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        totalSales,
        releasesProcessed,
        errors: errorCount,
        bandsCredited,
        labelsCredited,
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
