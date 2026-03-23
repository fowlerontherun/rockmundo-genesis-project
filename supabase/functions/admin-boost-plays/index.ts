import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: role, error: roleError } = await supabaseUser.rpc("get_user_role", {
      _user_id: user.id,
    });

    if (roleError || role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action || "boost_plays"; // default for backward compat

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ─── ACTION: BOOST PLAYS (original) ───
    if (action === "boost_plays") {
      const { songId, amount } = body;

      if (!songId || !amount || amount < 1 || amount > 1000) {
        return new Response(JSON.stringify({ error: "Invalid songId or amount (1-1000)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const plays = Array.from({ length: amount }, () => ({
        song_id: songId,
        user_id: crypto.randomUUID(),
        source: "admin_boost",
        played_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

      const { error: insertError } = await supabaseAdmin
        .from("song_plays")
        .insert(plays);

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Admin ${user.id} boosted song ${songId} with ${amount} plays`);
      return new Response(JSON.stringify({ success: true, added: amount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: RELEASE PUMP ───
    if (action === "release_pump") {
      const { releaseId, amount, saleType = "digital" } = body;
      const supportedSaleTypes = ["digital", "cd", "vinyl", "cassette"];

      if (!releaseId || !amount || amount < 1 || amount > 100000) {
        return new Response(JSON.stringify({ error: "Invalid releaseId or amount (1-100000)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!supportedSaleTypes.includes(saleType)) {
        return new Response(JSON.stringify({ error: "Invalid saleType (digital|cd|vinyl|cassette)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: release, error: releaseError } = await supabaseAdmin
        .from("releases")
        .select(`
          id, band_id, user_id, title,
          release_formats(id, format_type, retail_price, quantity)
        `)
        .eq("id", releaseId)
        .single();

      if (releaseError || !release) {
        return new Response(JSON.stringify({ error: "Release not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const selectedFormat = release.release_formats?.find((f: any) => f.format_type === saleType);
      if (!selectedFormat) {
        return new Response(JSON.stringify({ error: `No ${saleType} format found` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const retailPriceCents = selectedFormat.retail_price || 999;
      const retailPriceDollars = retailPriceCents / 100;
      const grossRevenue = Math.round(amount * retailPriceDollars * 100) / 100;

      const salesTaxRate = 0.10;
      const distributionRate = 0.30;
      const salesTaxAmount = Math.round(grossRevenue * salesTaxRate * 100) / 100;
      const distributionFee = Math.round(grossRevenue * distributionRate * 100) / 100;
      const netRevenue = grossRevenue - salesTaxAmount - distributionFee;

      const { error: saleInsertError } = await supabaseAdmin.from("release_sales").insert({
        release_format_id: selectedFormat.id,
        quantity_sold: amount,
        unit_price: retailPriceCents,
        total_amount: Math.round(grossRevenue * 100),
        sale_date: new Date().toISOString().split("T")[0],
        platform: "admin_pump",
        sales_tax_amount: Math.round(salesTaxAmount * 100),
        sales_tax_rate: salesTaxRate * 100,
        distribution_fee: Math.round(distributionFee * 100),
        distribution_rate: distributionRate * 100,
        net_revenue: Math.round(netRevenue * 100),
      });

      if (saleInsertError) {
        return new Response(JSON.stringify({ error: saleInsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduct physical inventory
      if (saleType !== "digital" && saleType !== "streaming") {
        const { error: inventoryError } = await supabaseAdmin
          .from("release_formats")
          .update({ quantity: Math.max(0, (selectedFormat.quantity || 0) - amount) })
          .eq("id", selectedFormat.id);
        
        if (inventoryError) {
          console.error(`Warning: Failed to deduct inventory: ${inventoryError.message}`);
        }
      }

      const { data: currentRelease, error: currentReleaseError } = await supabaseAdmin
        .from("releases")
        .select("id, total_units_sold, digital_sales, cd_sales, vinyl_sales, cassette_sales")
        .eq("id", releaseId)
        .single();

      if (currentReleaseError || !currentRelease) {
        return new Response(JSON.stringify({ error: currentReleaseError?.message || "Failed to load release totals" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const salesColumn = `${saleType}_sales`;
      const { error: releaseUpdateError } = await supabaseAdmin.from("releases").update({
        total_units_sold: (currentRelease.total_units_sold || 0) + amount,
        [salesColumn]: ((currentRelease as any)[salesColumn] || 0) + amount,
      }).eq("id", releaseId);

      if (releaseUpdateError) {
        return new Response(JSON.stringify({ error: releaseUpdateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: revenueError } = await supabaseAdmin.rpc("increment_release_revenue", {
        release_id: releaseId,
        amount: grossRevenue,
      });

      if (revenueError) {
        return new Response(JSON.stringify({ error: revenueError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (release.band_id) {
        const { error: earningsInsertError } = await supabaseAdmin.from("band_earnings").insert({
          band_id: release.band_id,
          amount: netRevenue,
          source: "release_sales",
          description: `Admin pumped ${amount} ${saleType} sales`,
          metadata: {
            format: saleType,
            units: amount,
            gross_revenue: grossRevenue,
            net_revenue: netRevenue,
            admin_pump: true,
            pumped_by: user.id,
          },
        });

        if (earningsInsertError) {
          return new Response(JSON.stringify({ error: earningsInsertError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: band, error: bandError } = await supabaseAdmin
          .from("bands")
          .select("band_balance")
          .eq("id", release.band_id)
          .single();

        if (bandError || !band) {
          return new Response(JSON.stringify({ error: bandError?.message || "Band not found" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: bandUpdateError } = await supabaseAdmin
          .from("bands")
          .update({ band_balance: (band.band_balance || 0) + netRevenue })
          .eq("id", release.band_id);

        if (bandUpdateError) {
          return new Response(JSON.stringify({ error: bandUpdateError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      console.log(`Admin ${user.id} pumped release ${releaseId} (${release.title}) with ${amount} ${saleType} sales. Net: $${netRevenue}`);

      const { data: updatedRelease, error: updatedReleaseError } = await supabaseAdmin
        .from("releases")
        .select("id, total_units_sold, total_revenue, digital_sales, cd_sales, vinyl_sales, cassette_sales")
        .eq("id", releaseId)
        .single();

      if (updatedReleaseError || !updatedRelease) {
        return new Response(JSON.stringify({ error: updatedReleaseError?.message || "Failed to load updated release totals" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        added: amount,
        sale_type: saleType,
        gross_revenue: grossRevenue,
        net_revenue: netRevenue,
        sales_tax: salesTaxAmount,
        distribution_fee: distributionFee,
        updated_release: updatedRelease,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
