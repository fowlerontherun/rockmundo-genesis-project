import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all released releases
    const { data: releases, error: releasesError } = await supabaseClient
      .from("releases")
      .select(`
        id,
        band_id,
        user_id,
        release_type,
        bands(fame, popularity, chemistry_level),
        release_formats(id, format_type, unit_price, stock_quantity),
        release_songs(song:songs(quality_score))
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

    let totalSales = 0;

    for (const release of releases || []) {
      const profile = release.user_id
        ? profilesMap.get(release.user_id as string)
        : undefined;

      const artistFame = release.bands?.[0]?.fame || profile?.fame || 0;
      const artistPopularity = release.bands?.[0]?.popularity || profile?.popularity || 0;
      
      // Calculate average song quality
      const avgQuality = release.release_songs?.reduce((sum: number, rs: any) => 
        sum + (rs.song?.quality_score || 50), 0
      ) / (release.release_songs?.length || 1);

      // Base daily sales calculation
      const fameMultiplier = 1 + (artistFame / 10000);
      const popularityMultiplier = 1 + (artistPopularity / 10000);
      const qualityMultiplier = avgQuality / 50;

      for (const format of release.release_formats || []) {
        if (!format.stock_quantity || format.stock_quantity <= 0) continue;

        // Calculate daily sales for this format
        let baseSales = 0;
        
        switch (format.format_type) {
          case 'digital':
            baseSales = 5 + Math.floor(Math.random() * 20);
            break;
          case 'cd':
            baseSales = 2 + Math.floor(Math.random() * 8);
            break;
          case 'vinyl':
            baseSales = 1 + Math.floor(Math.random() * 5);
            break;
          case 'cassette':
            baseSales = 1 + Math.floor(Math.random() * 3);
            break;
        }

        const calculatedSales = Math.floor(
          baseSales * fameMultiplier * popularityMultiplier * qualityMultiplier
        );
        
        const actualSales = Math.min(calculatedSales, format.stock_quantity || 0);

        if (actualSales > 0) {
          const revenue = actualSales * (format.unit_price || 0);

          // Insert sale record
          await supabaseClient.from("release_sales").insert({
            release_format_id: format.id,
            quantity_sold: actualSales,
            unit_price: format.unit_price,
            total_amount: revenue,
            sale_date: new Date().toISOString().split('T')[0],
            sale_region: "global"
          });

          // Update stock quantity for physical formats
          if (format.format_type !== 'digital') {
            await supabaseClient
              .from("release_formats")
              .update({ stock_quantity: (format.stock_quantity || 0) - actualSales })
              .eq("id", format.id);
          }

          // Update release total revenue
          await supabaseClient.rpc("increment_release_revenue", {
            release_id: release.id,
            amount: revenue
          });

          // Add to band/user earnings
          if (release.band_id) {
            await supabaseClient.from("band_earnings").insert({
              band_id: release.band_id,
              amount: revenue,
              source: "release_sales",
              description: `Daily sales revenue`,
              metadata: { format: format.format_type, units: actualSales }
            });
          }

          totalSales += actualSales;
        }
      }
    }

    console.log(`Generated ${totalSales} total sales across all releases`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalSales,
        message: `Generated sales for ${releases?.length || 0} releases`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating sales:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
