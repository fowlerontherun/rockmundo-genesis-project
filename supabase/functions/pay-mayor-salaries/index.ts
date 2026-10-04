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
        const { data: wasPaid, error: payErr } = await supabase.rpc("pay_mayor_salary_atomic", {
          p_mayor_id: mayor.id,
          p_week_of: weekOf,
          p_amount: weeklySalary,
        });
        if (payErr) throw payErr;
        if (!wasPaid) {
          skipped++;
          continue;
        }

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
