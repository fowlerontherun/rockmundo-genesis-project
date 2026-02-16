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
      const { releaseId, amount } = body;

      if (!releaseId || !amount || amount < 1 || amount > 100000) {
        return new Response(JSON.stringify({ error: "Invalid releaseId or amount (1-100000)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: release, error: releaseError } = await supabaseAdmin
        .from("releases")
        .select(`
          id, band_id, user_id, title,
          release_formats(id, format_type, retail_price)
        `)
        .eq("id", releaseId)
        .single();

      if (releaseError || !release) {
        return new Response(JSON.stringify({ error: "Release not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const digitalFormat = release.release_formats?.find((f: any) => f.format_type === "digital");
      if (!digitalFormat) {
        return new Response(JSON.stringify({ error: "No digital format found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const retailPriceCents = digitalFormat.retail_price || 999;
      const retailPriceDollars = retailPriceCents / 100;
      const grossRevenue = Math.round(amount * retailPriceDollars * 100) / 100;

      const salesTaxRate = 0.10;
      const distributionRate = 0.30;
      const salesTaxAmount = Math.round(grossRevenue * salesTaxRate * 100) / 100;
      const distributionFee = Math.round(grossRevenue * distributionRate * 100) / 100;
      const netRevenue = grossRevenue - salesTaxAmount - distributionFee;

      await supabaseAdmin.from("release_sales").insert({
        release_format_id: digitalFormat.id,
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

      const { data: currentRelease } = await supabaseAdmin
        .from("releases")
        .select("total_units_sold, digital_sales")
        .eq("id", releaseId)
        .single();

      if (currentRelease) {
        await supabaseAdmin.from("releases").update({
          total_units_sold: (currentRelease.total_units_sold || 0) + amount,
          digital_sales: (currentRelease.digital_sales || 0) + amount,
        }).eq("id", releaseId);
      }

      await supabaseAdmin.rpc("increment_release_revenue", {
        release_id: releaseId,
        amount: grossRevenue,
      });

      if (release.band_id) {
        await supabaseAdmin.from("band_earnings").insert({
          band_id: release.band_id,
          amount: netRevenue,
          source: "release_sales",
          description: `Admin pumped ${amount} digital sales`,
          metadata: {
            format: "digital",
            units: amount,
            gross_revenue: grossRevenue,
            net_revenue: netRevenue,
            admin_pump: true,
            pumped_by: user.id,
          },
        });

        const { data: band } = await supabaseAdmin
          .from("bands")
          .select("band_balance")
          .eq("id", release.band_id)
          .single();

        if (band) {
          await supabaseAdmin
            .from("bands")
            .update({ band_balance: (band.band_balance || 0) + netRevenue })
            .eq("id", release.band_id);
        }
      }

      console.log(`Admin ${user.id} pumped release ${releaseId} (${release.title}) with ${amount} digital sales. Net: $${netRevenue}`);

      return new Response(JSON.stringify({
        success: true,
        added: amount,
        gross_revenue: grossRevenue,
        net_revenue: netRevenue,
        sales_tax: salesTaxAmount,
        distribution_fee: distributionFee,
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
