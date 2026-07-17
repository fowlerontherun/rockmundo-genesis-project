import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { fromMinorUnits } from "@/services/finance/financeService";

export const useFinancialHistory = (limit = 25) => {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ["financial-ledger-history", profileId, limit],
    enabled: !!profileId,
    queryFn: async () => {
      const { data: account, error: accountError } = await (supabase as any).from("financial_accounts").select("id,current_balance_minor,reserved_balance_minor,available_balance_minor,default_currency_code").eq("owner_type", "player").eq("owner_id", profileId).eq("is_primary", true).single();
      if (accountError) throw accountError;
      const { data: transactions, error: txError } = await (supabase as any).from("financial_transactions").select("id,created_at,description,transaction_category,status,gross_amount_minor,source_account_id,destination_account_id").or(`source_account_id.eq.${account.id},destination_account_id.eq.${account.id}`).order("created_at", { ascending: false }).limit(limit);
      if (txError) throw txError;
      return { account: { ...account, currentBalance: fromMinorUnits(account.current_balance_minor), reservedBalance: fromMinorUnits(account.reserved_balance_minor), availableBalance: fromMinorUnits(account.available_balance_minor) }, transactions: (transactions ?? []).map((tx: any) => ({ ...tx, moneyIn: tx.destination_account_id === account.id ? fromMinorUnits(tx.gross_amount_minor) : 0, moneyOut: tx.source_account_id === account.id ? fromMinorUnits(tx.gross_amount_minor) : 0 })) };
    },
  });
};
