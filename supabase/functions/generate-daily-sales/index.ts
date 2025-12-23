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

    const { data: releases, error: releasesError } = await supabaseClient
      .from("releases")
      .select(`
        id,
        band_id,
        user_id,
        release_type,
        bands(fame, popularity, chemistry_level),
        release_formats(id, format_type, retail_price, quantity),
        release_songs!release_songs_release_id_fkey(song:songs(quality_score))
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
    // At 10 bands: 5x boost, at 50 bands: 2x, at 100+ bands: 1x
    const marketMultiplier = Math.max(1, Math.min(5, 100 / Math.max(activeBandCount || 100, 20)));
    console.log(`Market multiplier: ${marketMultiplier.toFixed(2)} (${activeBandCount} active bands)`);

    for (const release of releases || []) {
      try {
        releasesProcessed += 1;

        const profile = release.user_id
          ? profilesMap.get(release.user_id as string)
          : undefined;

        const artistFame = release.bands?.[0]?.fame || profile?.fame || 0;
        const artistPopularity = release.bands?.[0]?.popularity || profile?.popularity || 0;

        const avgQuality =
          (release.release_songs?.reduce(
            (sum: number, rs: any) => sum + (rs.song?.quality_score || 50),
            0
          ) ?? 50) / (release.release_songs?.length || 1);

        const fameMultiplier = 1 + artistFame / 10000;
        const popularityMultiplier = 1 + artistPopularity / 10000;
        const qualityMultiplier = avgQuality / 50;

        for (const format of release.release_formats || []) {
          // For physical formats, skip if no stock. For digital/streaming, always allow sales
          const isDigital = format.format_type === "digital" || format.format_type === "streaming";
          if (!isDigital && (!format.quantity || format.quantity <= 0)) continue;

          let baseSales = 0;

          switch (format.format_type) {
            case "digital":
              baseSales = 5 + Math.floor(Math.random() * 20);
              break;
            case "streaming":
              // Streaming doesn't generate direct sales, skip
              continue;
            case "cd":
              baseSales = 2 + Math.floor(Math.random() * 8);
              break;
            case "vinyl":
              baseSales = 1 + Math.floor(Math.random() * 5);
              break;
            case "cassette":
              baseSales = 1 + Math.floor(Math.random() * 3);
              break;
          }

          const calculatedSales = Math.floor(
            baseSales * fameMultiplier * popularityMultiplier * qualityMultiplier * marketMultiplier
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
