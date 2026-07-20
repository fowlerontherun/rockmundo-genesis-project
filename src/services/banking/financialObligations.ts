import { supabase } from "@/integrations/supabase/client";

export type FinancialObligation = {
  id: string;
  obligation_type: string;
  owner_type: string;
  owner_id: string;
  linked_asset_type: string | null;
  linked_asset_id: string | null;
  amount_minor: number;
  currency_code: string;
  frequency: string;
  next_due_date: string;
  grace_period_days: number;
  status: string;
  missed_payment_count: number;
  outstanding_balance_minor: number;
};

export type ObligationScheduleLine = { id: string; obligation_id: string; due_date: string; amount_minor: number; status: string; paid_at: string | null };
export type DebtRecord = { id: string; obligation_id: string | null; original_amount_minor: number; outstanding_balance_minor: number; currency_code: string; collection_stage: string; status: string; updated_at: string };
export type CreditHistoryEvent = { id: string; event_type: string; event_date: string; amount_minor: number; currency_code: string | null; score_delta: number };
export type CreditScore = { credit_score: number; credit_band: string; calculated_at: string };

export async function loadFinancialObligationsDashboard(profileId?: string) {
  const [obligations, schedule, debts, creditHistory, creditScore] = await Promise.all([
    supabase.from("financial_obligations").select("id,obligation_type,owner_type,owner_id,linked_asset_type,linked_asset_id,amount_minor,currency_code,frequency,next_due_date,grace_period_days,status,missed_payment_count,outstanding_balance_minor").order("next_due_date", { ascending: true }).limit(25),
    supabase.from("financial_obligation_schedule").select("id,obligation_id,due_date,amount_minor,status,paid_at").in("status", ["scheduled", "due", "missed", "failed", "paid"]).order("due_date", { ascending: true }).limit(25),
    profileId ? supabase.from("debt_records").select("id,obligation_id,original_amount_minor,outstanding_balance_minor,currency_code,collection_stage,status,updated_at").eq("owner_type", "player").eq("owner_id", profileId).order("updated_at", { ascending: false }).limit(10) : Promise.resolve({ data: [], error: null }),
    profileId ? supabase.from("player_credit_history").select("id,event_type,event_date,amount_minor,currency_code,score_delta").eq("profile_id", profileId).order("event_date", { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
    profileId ? supabase.from("player_credit_scores").select("credit_score,credit_band,calculated_at").eq("profile_id", profileId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  for (const result of [obligations, schedule, debts, creditHistory, creditScore]) {
    if (result.error) throw result.error;
  }

  return {
    obligations: (obligations.data ?? []) as FinancialObligation[],
    schedule: (schedule.data ?? []) as ObligationScheduleLine[],
    debts: (debts.data ?? []) as DebtRecord[],
    creditHistory: (creditHistory.data ?? []) as CreditHistoryEvent[],
    creditScore: creditScore.data as CreditScore | null,
  };
}
