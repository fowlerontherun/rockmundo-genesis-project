import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const { data: obligations, error } = await supabase
    .from("recurring_financial_obligations")
    .select("*")
    .in("status", ["active", "overdue", "failed"])
    .lte("next_due_date", today)
    .eq("auto_pay_enabled", true)
    .order("priority", { ascending: true })
    .limit(100);
  if (error) throw error;

  const results = [];
  for (const obligation of obligations ?? []) {
    const idempotencyKey = `recurring-${obligation.id}-${obligation.next_due_date}`;
    const { data: existing } = await supabase.from("recurring_payment_attempts").select("id,status").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing?.status === "paid") { results.push({ obligationId: obligation.id, status: "duplicate_skipped" }); continue; }
    const { data: tx, error: rpcError } = await supabase.rpc("finance_debit_owner", {
      p_owner_type: obligation.owner_type,
      p_owner_id: obligation.owner_id,
      p_amount_minor: obligation.amount_minor,
      p_category: obligation.expense_category,
      p_description: obligation.description,
      p_idempotency_key: idempotencyKey,
      p_created_by_profile_id: null,
      p_metadata: { obligation_id: obligation.id, due_date: obligation.next_due_date },
    });
    if (rpcError) {
      await supabase.from("recurring_payment_attempts").insert({ obligation_id: obligation.id, due_date: obligation.next_due_date, amount_minor: obligation.amount_minor, status: "failed", idempotency_key: idempotencyKey, error_code: rpcError.code, error_message: rpcError.message });
      await supabase.from("recurring_financial_obligations").update({ status: "overdue", last_attempted_at: new Date().toISOString(), failure_count: (obligation.failure_count ?? 0) + 1 }).eq("id", obligation.id);
      results.push({ obligationId: obligation.id, status: "failed" });
      continue;
    }
    await supabase.from("recurring_payment_attempts").insert({ obligation_id: obligation.id, due_date: obligation.next_due_date, amount_minor: obligation.amount_minor, status: "paid", transaction_id: tx, idempotency_key: idempotencyKey });
    const nextDue = new Date(obligation.next_due_date + "T00:00:00Z");
    if (obligation.frequency === "daily") nextDue.setUTCDate(nextDue.getUTCDate() + 1);
    if (obligation.frequency === "weekly") nextDue.setUTCDate(nextDue.getUTCDate() + 7);
    if (obligation.frequency === "monthly") nextDue.setUTCMonth(nextDue.getUTCMonth() + 1);
    if (obligation.frequency === "custom_interval") nextDue.setUTCDate(nextDue.getUTCDate() + (obligation.custom_interval_days ?? 1));
    await supabase.from("recurring_financial_obligations").update({ status: "active", last_attempted_at: new Date().toISOString(), last_paid_at: new Date().toISOString(), next_due_date: nextDue.toISOString().slice(0, 10), failure_count: 0 }).eq("id", obligation.id);
    results.push({ obligationId: obligation.id, status: "paid", transactionId: tx });
  }
  return new Response(JSON.stringify({ processed: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
