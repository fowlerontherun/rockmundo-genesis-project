import { supabase } from "@/integrations/supabase/client";

export interface RoyaltyRecoupmentResult {
  cashToPlayer: number;
  totalRecouped: number;
}

const normalizeCurrency = (value: number) => {
  return Math.round(value * 100) / 100;
};

const parseNumeric = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const applyRoyaltyRecoupment = async (
  userId: string,
  earnings: number
): Promise<RoyaltyRecoupmentResult> => {
  if (!userId || earnings <= 0) {
    return { cashToPlayer: 0, totalRecouped: 0 };
  }

  let remaining = normalizeCurrency(earnings);

  const { data: contracts, error } = await supabase
    .from("contracts" as any)
    .select("id, advance_balance, recouped_amount")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("signed_at", { ascending: true });

  if (error) throw error;

  const updates: Array<{ id: string; advance_balance: number; recouped_amount: number }> = [];

  (contracts ?? []).forEach((contract: any) => {
    if (remaining <= 0) {
      return;
    }

    const currentBalance = normalizeCurrency(parseNumeric(contract.advance_balance));
    if (currentBalance <= 0) {
      return;
    }

    const currentRecouped = normalizeCurrency(parseNumeric(contract.recouped_amount));
    const applied = normalizeCurrency(Math.min(currentBalance, remaining));

    remaining = normalizeCurrency(remaining - applied);

    const nextBalance = normalizeCurrency(Math.max(currentBalance - applied, 0));
    const nextRecouped = normalizeCurrency(currentRecouped + applied);

    updates.push({
      id: contract.id,
      advance_balance: nextBalance <= 0.01 ? 0 : nextBalance,
      recouped_amount: nextRecouped,
    });
  });

  if (updates.length > 0) {
    const updatePromises = updates.map((update) =>
      supabase
        .from("contracts" as any)
        .update({
          advance_balance: update.advance_balance,
          recouped_amount: update.recouped_amount,
        } as any)
        .eq("id", update.id)
    );

    const results = await Promise.all(updatePromises);
    results.forEach(({ error: updateError }) => {
      if (updateError) {
        throw updateError;
      }
    });
  }

  const cashToPlayer = normalizeCurrency(remaining);
  const totalRecouped = normalizeCurrency(earnings - cashToPlayer);

  return { cashToPlayer, totalRecouped };
};
