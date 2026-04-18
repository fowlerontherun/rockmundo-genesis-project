import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all active bands with weekly_pay_percent > 0
    const { data: bands, error: bandsError } = await supabase
      .from("bands")
      .select("id, name, band_balance, weekly_pay_percent, leader_id, status")
      .gt("weekly_pay_percent", 0)
      .in("status", ["active", "hiatus"]);

    if (bandsError) throw bandsError;

    let totalPaid = 0;
    let bandsPaid = 0;

    for (const band of bands ?? []) {
      const pct = Number(band.weekly_pay_percent ?? 0);
      const balance = Number(band.band_balance ?? 0);

      if (pct <= 0 || balance <= 0) continue;

      // Get real (non-touring) members
      const { data: members, error: membersError } = await supabase
        .from("band_members")
        .select("id, user_id, profile_id, is_touring_member")
        .eq("band_id", band.id)
        .eq("is_touring_member", false);

      if (membersError) {
        console.error(`Error fetching members for band ${band.id}:`, membersError);
        continue;
      }

      if (!members || members.length === 0) continue;

      // Compute payroll: pct of balance, split equally
      const totalPayout = Math.floor((balance * pct) / 100);
      if (totalPayout <= 0) continue;

      const payPerMember = Math.floor(totalPayout / members.length);
      if (payPerMember <= 0) continue;

      const actualTotal = payPerMember * members.length;

      // Deduct from band balance
      const { error: updateError } = await supabase
        .from("bands")
        .update({ band_balance: balance - actualTotal })
        .eq("id", band.id);

      if (updateError) {
        console.error(`Error updating balance for band ${band.id}:`, updateError);
        continue;
      }

      // Record the band expense
      await supabase.from("band_earnings").insert({
        band_id: band.id,
        amount: -actualTotal,
        source: "weekly_pay",
        description: `Weekly payroll: ${pct}% of balance — ${formatCurrency(payPerMember)} × ${members.length} members`,
        earned_by_user_id: band.leader_id,
      });

      // Pay each member's profile
      for (const member of members) {
        if (!member.profile_id) continue;

        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("id", member.profile_id)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ cash: (profile.cash ?? 0) + payPerMember })
            .eq("id", member.profile_id);
        }

        if (member.user_id) {
          await supabase.from("activity_feed").insert({
            user_id: member.user_id,
            profile_id: member.profile_id,
            activity_type: "band_pay",
            message: `Received ${formatCurrency(payPerMember)} weekly pay from ${band.name}`,
            earnings: payPerMember,
          });
        }
      }

      totalPaid += actualTotal;
      bandsPaid++;
    }

    return new Response(
      JSON.stringify({ success: true, bandsPaid, totalPaid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Weekly pay error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
