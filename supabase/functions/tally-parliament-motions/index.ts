// Closes any open parliament motions whose `voting_closes_at` is in the past.
// Marks them passed/rejected/expired based on yes/no/abstain tallies. For
// `mayor_pay` motions that pass, applies the new `weekly_salary_cents` from
// the motion payload to `mayor_pay_settings`.

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
    const nowIso = new Date().toISOString();
    const { data: motions, error } = await supabase
      .from("world_parliament_motions")
      .select("*")
      .eq("status", "open")
      .lte("voting_closes_at", nowIso)
      .limit(200);
    if (error) throw error;

    const results: Array<{ id: string; status: string }> = [];

    for (const m of motions ?? []) {
      const total = (m.yes_votes ?? 0) + (m.no_votes ?? 0) + (m.abstain_votes ?? 0);
      let status: "passed" | "rejected" | "expired";
      if (total === 0) {
        status = "expired";
      } else if ((m.yes_votes ?? 0) > (m.no_votes ?? 0)) {
        status = "passed";
      } else {
        status = "rejected";
      }

      await supabase
        .from("world_parliament_motions")
        .update({ status, resolved_at: nowIso })
        .eq("id", m.id);

      // Apply mayor-pay change if relevant
      if (status === "passed" && m.motion_type === "mayor_pay") {
        const payload = (m.payload ?? {}) as Record<string, unknown>;
        const newPay = Number(payload.weekly_salary_cents);
        if (Number.isFinite(newPay) && newPay > 0) {
          // Clamp to bounds
          const { data: settings } = await supabase
            .from("mayor_pay_settings")
            .select("min_salary, max_salary")
            .eq("id", 1)
            .maybeSingle();
          const min = Number(settings?.min_salary ?? 500_000);
          const max = Number(settings?.max_salary ?? 5_000_000);
          const clamped = Math.max(min, Math.min(max, newPay));
          await supabase
            .from("mayor_pay_settings")
            .update({
              weekly_salary_per_mayor: clamped,
              last_motion_id: m.id,
              updated_at: nowIso,
            })
            .eq("id", 1);
        }
      }

      results.push({ id: m.id, status });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
