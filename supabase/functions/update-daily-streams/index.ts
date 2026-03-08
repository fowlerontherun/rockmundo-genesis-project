import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from '../_shared/job-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-triggered-by',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get('x-triggered-by') ?? undefined;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let runId: string | null = null;
  const startedAt = Date.now();
  let streamUpdates = 0;
  let salesUpdates = 0;
  let errorCount = 0;
  const errorSamples: string[] = [];

  // Accumulate label revenue for batch crediting
  const labelRevenueAccumulator = new Map<string, { labelRevenue: number; recoupmentApplied: number; contractId: string }>();

  try {
    console.log('Starting daily streams and sales update...');

    runId = await startJobRun({
      jobName: 'update-daily-streams',
      functionName: 'update-daily-streams',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const { data: streamingReleases, error: streamingError } = await supabase
      .from('song_releases')
      .select(`
        id, 
        song_id, 
        platform_id, 
        total_streams, 
        total_revenue,
        band_id,
        user_id,
        created_at,
        release_id,
        songs!inner(band_id)
      `)
      .eq('is_active', true)
      .eq('release_type', 'streaming');

    if (streamingError) {
      throw streamingError;
    }

    // Get active band count for market scaling
    const { count: activeBandCount } = await supabase
      .from('bands')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    const marketMultiplier = Math.max(1, Math.min(5, 100 / Math.max(activeBandCount || 100, 20)));
    console.log(`Stream market multiplier: ${marketMultiplier.toFixed(2)} (${activeBandCount} active bands)`);

    const AGE_GROUPS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];
    const AGE_WEIGHTS = [
      { group: '13-17', weight: 0.12 },
      { group: '18-24', weight: 0.30 },
      { group: '25-34', weight: 0.25 },
      { group: '35-44', weight: 0.18 },
      { group: '45-54', weight: 0.10 },
      { group: '55+', weight: 0.05 },
    ];

    // Pre-fetch all territories for releases linked to these song_releases
    const releaseIds = [...new Set((streamingReleases || []).map(r => r.release_id).filter(Boolean))];
    let allTerritories: any[] = [];
    if (releaseIds.length > 0) {
      const { data: territories } = await supabase
        .from('release_territories')
        .select('release_id, country, is_active')
        .in('release_id', releaseIds)
        .eq('is_active', true);
      allTerritories = territories || [];
    }

    // Pre-fetch label contract info for releases
    let releaseContractMap = new Map<string, { contractId: string; labelId: string; labelCutPct: number; advanceAmount: number; recoupedAmount: number; dealTypeName: string; endDate: string }>();
    if (releaseIds.length > 0) {
      const { data: releasesWithContracts } = await supabase
        .from('releases')
        .select('id, label_contract_id, label_revenue_share_pct')
        .in('id', releaseIds)
        .not('label_contract_id', 'is', null);

      const contractIds = [...new Set((releasesWithContracts || []).map(r => r.label_contract_id).filter(Boolean))];
      if (contractIds.length > 0) {
        const { data: contracts } = await supabase
          .from('artist_label_contracts')
          .select('id, label_id, royalty_label_pct, royalty_artist_pct, advance_amount, recouped_amount, status, deal_type_id, end_date')
          .in('id', contractIds)
          .eq('status', 'active');

        // Fetch deal type names
        const dealTypeIds = [...new Set((contracts || []).map(c => c.deal_type_id).filter(Boolean))];
        const dealTypeNameMap = new Map<string, string>();
        if (dealTypeIds.length > 0) {
          const { data: dealTypes } = await supabase
            .from('label_deal_types')
            .select('id, name')
            .in('id', dealTypeIds);
          for (const dt of dealTypes || []) {
            dealTypeNameMap.set(dt.id, dt.name);
          }
        }

        const contractLookup = new Map((contracts || []).map(c => [c.id, c]));

        for (const rel of releasesWithContracts || []) {
          const c = contractLookup.get(rel.label_contract_id);
          if (c) {
            const dealTypeName = dealTypeNameMap.get(c.deal_type_id) || "Standard Deal";
            releaseContractMap.set(rel.id, {
              contractId: c.id,
              labelId: c.label_id,
              labelCutPct: (rel.label_revenue_share_pct ?? c.royalty_label_pct ?? (100 - c.royalty_artist_pct)) / 100,
              advanceAmount: c.advance_amount ?? 0,
              recoupedAmount: c.recouped_amount ?? 0,
              dealTypeName,
              endDate: c.end_date,
            });
          }
        }
        console.log(`Loaded ${releaseContractMap.size} release-contract mappings for streaming splits`);
      }
    }

    // Pre-fetch all release hype scores for streaming releases
    const songIds = (streamingReleases || []).map(r => r.song_id).filter(Boolean);
    let releaseHypeMap = new Map<string, number>();
    if (songIds.length > 0) {
      const { data: releaseSongData } = await supabase
        .from("release_songs")
        .select("song_id, release:releases(id, hype_score, manufacturing_complete_at)")
        .in("song_id", songIds);
      
      if (releaseSongData) {
        for (const rs of releaseSongData) {
          const rel = (rs as any).release;
          if (rel && rel.hype_score) {
            const existing = releaseHypeMap.get(rs.song_id) || 0;
            releaseHypeMap.set(rs.song_id, Math.max(existing, rel.hype_score));
          }
        }
      }
    }

    // Pre-fetch band country fans for territory weighting
    const bandIds = [...new Set((streamingReleases || []).map(r => r.band_id || (r.songs as any)?.band_id).filter(Boolean))];
    let bandCountryFansMap = new Map<string, Map<string, number>>();
    if (bandIds.length > 0) {
      const { data: bcf } = await supabase
        .from('band_country_fans')
        .select('band_id, country, fame, total_fans')
        .in('band_id', bandIds);
      
      for (const entry of bcf || []) {
        if (!bandCountryFansMap.has(entry.band_id)) {
          bandCountryFansMap.set(entry.band_id, new Map());
        }
        bandCountryFansMap.get(entry.band_id)!.set(entry.country, entry.fame || 0);
      }
    }

    // Pre-fetch band fame and total fans for fame-based stream scaling
    let bandFameMap = new Map<string, { fame: number; totalFans: number }>();
    if (bandIds.length > 0) {
      const { data: bandData } = await supabase
        .from('bands')
        .select('id, fame, weekly_fans')
        .in('id', bandIds);
      
      for (const b of bandData || []) {
        const countryFans = bandCountryFansMap.get(b.id);
        let totalFans = b.weekly_fans || 0;
        if (countryFans) {
          totalFans = Math.max(totalFans, [...countryFans.values()].reduce((s, f) => s + f, 0));
        }
        bandFameMap.set(b.id, { fame: b.fame || 0, totalFans });
      }
    }

    const analyticsDate = new Date().toISOString().split('T')[0];

    for (const release of streamingReleases || []) {
      try {
        const bandId = release.band_id || (release.songs as any)?.band_id;
        const bandStats = bandId ? bandFameMap.get(bandId) : undefined;
        const bandFame = bandStats?.fame || 0;
        const bandTotalFans = bandStats?.totalFans || 0;

        // Fame-scaled base streams
        const fameScale = 1 + Math.pow(bandFame / 100, 1.4);
        const fanBoost = 1 + (bandTotalFans / 500);
        const combinedFameMultiplier = Math.sqrt(fameScale * fanBoost);
        
        const baseStreams = Math.floor((Math.random() * 200 + 50) * combinedFameMultiplier);
        
        const releaseDate = release.created_at ? new Date(release.created_at) : new Date();
        const daysSinceRelease = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);
        const ageDecay = daysSinceRelease <= 7 ? 1.5
          : daysSinceRelease <= 30 ? 1.0
          : daysSinceRelease <= 60 ? 0.7
          : daysSinceRelease <= 90 ? 0.5
          : daysSinceRelease <= 180 ? 0.35
          : 0.2;
        
        const songHype = releaseHypeMap.get(release.song_id) || 0;
        const streamHypeMultiplier = 1 + (songHype / 500);
        
        // Get territories for this release
        const releaseTerritories = allTerritories.filter(t => t.release_id === release.release_id);
        const hasTerritories = releaseTerritories.length > 0;
        const bandFans = bandId ? bandCountryFansMap.get(bandId) : undefined;

        const territoryBonus = hasTerritories ? Math.sqrt(releaseTerritories.length) : 1;

        const dailyStreams = Math.floor(baseStreams * marketMultiplier * streamHypeMultiplier * ageDecay * territoryBonus);
        const dailyRevenueDollars = Math.round(dailyStreams * 0.004);

        // Build deterministic region breakdown based on territories/fans
        let regionBreakdown: Array<{ region: string; streams: number; revenue: number }> = [];
        
        if (hasTerritories) {
          const weightedCountries = releaseTerritories.map(t => {
            const fame = bandFans?.get(t.country) || 1;
            return { country: t.country, weight: fame };
          });
          const totalWeight = weightedCountries.reduce((s, c) => s + c.weight, 0);
          
          for (const wc of weightedCountries) {
            const fraction = wc.weight / totalWeight;
            const regionStreams = Math.max(1, Math.round(dailyStreams * fraction));
            const regionRevenue = Math.round(regionStreams * 0.004);
            regionBreakdown.push({ region: wc.country, streams: regionStreams, revenue: regionRevenue });
          }
        } else {
          const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'UK & Ireland', 'Scandinavia', 'Australia & NZ'];
          const REGION_WEIGHTS = [0.30, 0.25, 0.20, 0.10, 0.08, 0.04, 0.03];
          for (let i = 0; i < REGIONS.length; i++) {
            const regionStreams = Math.max(1, Math.round(dailyStreams * REGION_WEIGHTS[i]));
            const regionRevenue = Math.round(regionStreams * 0.004);
            regionBreakdown.push({ region: REGIONS[i], streams: regionStreams, revenue: regionRevenue });
          }
        }

        // FIX: Use Math.round for integer-safe total_revenue accumulation
        const { error: updateError } = await supabase
          .from('song_releases')
          .update({
            total_streams: (release.total_streams || 0) + dailyStreams,
            total_revenue: Math.round((release.total_revenue || 0)) + dailyRevenueDollars,
          })
          .eq('id', release.id);

        if (updateError) {
          throw updateError;
        }

        // Insert analytics rows per region
        for (const rb of regionBreakdown) {
          const listenerRatio = 0.4 + Math.random() * 0.4;
          const uniqueListeners = Math.max(1, Math.floor(rb.streams * listenerRatio));
          const skipRate = Number((10 + Math.random() * 25).toFixed(1));
          const completionRate = Number((55 + Math.random() * 35).toFixed(1));
          
          const ageRoll = Math.random();
          let cumWeight = 0;
          let ageGroup = AGE_GROUPS[1];
          for (const aw of AGE_WEIGHTS) {
            cumWeight += aw.weight;
            if (ageRoll <= cumWeight) {
              ageGroup = aw.group;
              break;
            }
          }

          await supabase.from('streaming_analytics_daily').insert({
            song_release_id: release.id,
            analytics_date: analyticsDate,
            daily_streams: rb.streams,
            daily_revenue: rb.revenue,
            platform_id: release.platform_id,
            unique_listeners: uniqueListeners,
            skip_rate: skipRate,
            completion_rate: completionRate,
            listener_age_group: ageGroup,
            listener_region: rb.region,
          });
        }

        // Update song fame based on streams
        if (release.song_id) {
          const fameGain = Math.floor(dailyStreams / 1000);
          if (fameGain > 0) {
            await supabase.rpc('update_song_fame', {
              p_song_id: release.song_id,
              p_fame_amount: fameGain,
              p_source: 'streaming'
            });
          }
          
          const hypeChange = Math.floor(dailyStreams / 5000) - 1;
          await supabase.rpc('update_song_hype', {
            p_song_id: release.song_id,
            p_hype_change: hypeChange
          });
        }

        // ── Label Revenue Split for Streaming ──
        const contractInfo = release.release_id ? releaseContractMap.get(release.release_id) : null;

        if (contractInfo && bandId && dailyRevenueDollars > 0) {
          const labelShareDollars = Math.round(dailyRevenueDollars * contractInfo.labelCutPct);
          const bandShareDollars = dailyRevenueDollars - labelShareDollars;

          // Recoupment tracking
          const advanceRemaining = Math.max(0, contractInfo.advanceAmount - contractInfo.recoupedAmount);
          const recoupmentFromThis = Math.min(labelShareDollars, advanceRemaining);
          contractInfo.recoupedAmount += recoupmentFromThis;

          // Accumulate label revenue
          const labelKey = `${contractInfo.labelId}:${contractInfo.contractId}`;
          const existing = labelRevenueAccumulator.get(labelKey) || { labelRevenue: 0, recoupmentApplied: 0, contractId: contractInfo.contractId };
          existing.labelRevenue += labelShareDollars;
          existing.recoupmentApplied += recoupmentFromThis;
          labelRevenueAccumulator.set(labelKey, existing);

          // Pay band their reduced share
          if (bandShareDollars > 0) {
            await supabase.from('band_earnings').insert({
              band_id: bandId,
              amount: bandShareDollars,
              source: 'streaming',
              description: `Daily streaming revenue (after ${Math.round(contractInfo.labelCutPct * 100)}% label share)`,
              metadata: { 
                song_release_id: release.id, 
                streams: dailyStreams,
                platform_id: release.platform_id,
                label_share: labelShareDollars,
              },
            });
          }
        } else if (bandId && dailyRevenueDollars > 0) {
          // No label contract — 100% to band
          await supabase.from('band_earnings').insert({
            band_id: bandId,
            amount: dailyRevenueDollars,
            source: 'streaming',
            description: `Daily streaming revenue`,
            metadata: { 
              song_release_id: release.id, 
              streams: dailyStreams,
              platform_id: release.platform_id 
            },
          });
        }

        streamUpdates++;
      } catch (streamError) {
        errorCount += 1;
        if (errorSamples.length < 5) {
          errorSamples.push(`Release ${release.id}: ${(streamError as Error)?.message || String(streamError)}`);
        }
        console.error(`Error processing streaming release ${release.id}:`, streamError);
      }
    }

    const { data: physicalReleases, error: physicalError } = await supabase
      .from('release_formats')
      .select('id, release_id, format_type')
      .in('format_type', ['digital', 'cd', 'vinyl'])
      .gte('release_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (physicalError) {
      throw physicalError;
    }

    for (const format of physicalReleases || []) {
      if (Math.random() > 0.5) {
        try {
          const baseQuantity = Math.floor(Math.random() * 10) + 1;
          const quantity = Math.floor(baseQuantity * marketMultiplier);
          let pricePerUnit = 10;

          if (format.format_type === 'cd') pricePerUnit = 15;
          if (format.format_type === 'vinyl') pricePerUnit = 25;

          const totalAmount = quantity * pricePerUnit;

          const { error: saleError } = await supabase
            .from('release_sales')
            .insert({
              release_format_id: format.id,
              quantity_sold: quantity,
              total_amount: totalAmount,
              sale_date: new Date().toISOString(),
            });

          if (saleError) {
            throw saleError;
          }

          await supabase.rpc('increment_release_revenue', {
            release_id: format.release_id,
            amount: totalAmount,
          });

          salesUpdates++;
        } catch (salesError) {
          errorCount += 1;
          if (errorSamples.length < 5) {
            errorSamples.push(`Format ${format.id}: ${(salesError as Error)?.message || String(salesError)}`);
          }
          console.error(`Error processing physical sales for format ${format.id}:`, salesError);
        }
      }
    }

    // ── Batch credit labels with accumulated streaming revenue ──
    let labelsCredited = 0;
    for (const [labelKey, labelRevenue] of labelRevenueAccumulator.entries()) {
      if (labelRevenue.labelRevenue <= 0) continue;
      try {
        const [labelId] = labelKey.split(":");
        const labelAmount = Math.round(labelRevenue.labelRevenue);
        const recoupAmount = Math.round(labelRevenue.recoupmentApplied);

        // Credit label balance
        const { data: currentLabel } = await supabase
          .from("labels")
          .select("balance")
          .eq("id", labelId)
          .single();

        if (currentLabel) {
          await supabase
            .from("labels")
            .update({ balance: (currentLabel.balance || 0) + labelAmount })
            .eq("id", labelId);
        }

        // Record label financial transaction
        await supabase.from("label_financial_transactions").insert({
          label_id: labelId,
          transaction_type: "revenue",
          amount: labelAmount,
          description: `Daily streaming royalty share${recoupAmount > 0 ? ` (includes $${recoupAmount} advance recoupment)` : ''}`,
          related_contract_id: labelRevenue.contractId,
        });

        // Update contract recouped_amount
        if (recoupAmount > 0) {
          const { data: currentContract } = await supabase
            .from("artist_label_contracts")
            .select("recouped_amount")
            .eq("id", labelRevenue.contractId)
            .single();

          if (currentContract) {
            await supabase
              .from("artist_label_contracts")
              .update({ recouped_amount: (currentContract.recouped_amount || 0) + recoupAmount })
              .eq("id", labelRevenue.contractId);
          }
        }

        labelsCredited++;
        console.log(`Credited label ${labelId}: $${labelAmount} streaming (recouped: $${recoupAmount})`);
      } catch (labelError) {
        console.error(`Error crediting label ${labelKey}:`, labelError);
        errorCount++;
      }
    }
    console.log(`Credited ${labelsCredited} labels with streaming royalty revenue`);

    const totalProcessed = streamUpdates + salesUpdates;
    const isEffectivelyFailed = totalProcessed > 0 && errorCount > totalProcessed * 0.5;
    
    console.log(`Updated ${streamUpdates} streaming releases and generated ${salesUpdates} sales (${errorCount} errors)`);

    await completeJobRun({
      jobName: 'update-daily-streams',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: totalProcessed,
      errorCount,
      resultSummary: {
        streamUpdates,
        salesUpdates,
        errorCount,
        errorSamples,
        effectivelyFailed: isEffectivelyFailed,
        labelsCredited,
      },
    });

    return new Response(
      JSON.stringify({
        success: !isEffectivelyFailed,
        streamUpdates,
        salesUpdates,
        errors: errorCount,
        errorSamples,
        labelsCredited,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    await failJobRun({
      jobName: 'update-daily-streams',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: {
        streamUpdates,
        salesUpdates,
        errorCount,
        errorSamples,
      },
    });

    console.error('Error updating daily streams:', error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
