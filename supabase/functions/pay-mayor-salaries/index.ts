// Weekly mayor salary payout. Reads `mayor_pay_settings.weekly_salary_per_mayor`,
// debits each city treasury, credits the mayor's profile cash, and inserts
// audit rows into `mayor_salary_payments`.
//
// Triggered by the pg_cron schedule defined alongside this function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // 1. Read salary settings
    const { data: settings, error: settingsErr } = await supabase
      .from("mayor_pay_settings")
      .select("weekly_salary_per_mayor")
      .eq("id", 1)
      .maybeSingle();
    if (settingsErr) throw settingsErr;
    const weeklySalary = settings?.weekly_salary_per_mayor ?? 1_500_000; // cents

    // 2. Find the most recent Monday (week_of)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sun
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - daysSinceMonday);
    monday.setUTCHours(0, 0, 0, 0);
    const weekOf = monday.toISOString().slice(0, 10);

    // 3. Pull every sitting mayor
    const { data: mayors, error: mayorsErr } = await supabase
      .from("city_mayors")
      .select("id, profile_id, city_id")
      .eq("is_current", true);
    if (mayorsErr) throw mayorsErr;

    let paid = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const mayor of mayors ?? []) {
      try {
        // Skip if already paid this week
        const { data: existing } = await supabase
          .from("mayor_salary_payments")
          .select("id")
          .eq("mayor_id", mayor.id)
          .eq("week_of", weekOf)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        // Insert audit row + credit profile cash
        const { error: insErr } = await supabase
          .from("mayor_salary_payments")
          .insert({
            mayor_id: mayor.id,
            profile_id: mayor.profile_id,
            city_id: mayor.city_id,
            amount: weeklySalary,
            week_of: weekOf,
          });
        if (insErr) throw insErr;

        // Credit player cash (cents stored in profiles.cash as integer cents
        // is not standard here — we use profiles.cash in dollars per existing
        // schema, so divide by 100). If the column is in cents, adjust.
        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("id", mayor.profile_id)
          .maybeSingle();
        const currentCash = Number(profile?.cash ?? 0);
        const dollars = weeklySalary / 100;
        await supabase
          .from("profiles")
          .update({ cash: currentCash + dollars })
          .eq("id", mayor.profile_id);

        paid++;
      } catch (e) {
        errors.push(`${mayor.id}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, paid, skipped, errors, weekOf, weeklySalary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
