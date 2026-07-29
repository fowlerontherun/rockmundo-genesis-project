import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/components/ui/use-toast";
import { calculateInGameDate } from "@/utils/gameCalendar";

export { useIssueCompanyShares } from "@/hooks/useCompanyShareOffers";

export interface CompanyShareholder {
  id: string;
  company_id: string;
  user_id: string;
  shares: number;
  profile?: { id: string; stage_name: string | null; username: string | null } | null;
}

export const useCompanyShareholders = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ["company-shareholders", companyId],
    queryFn: async () => {
      if (!companyId) return [] as CompanyShareholder[];

      const { data, error } = await supabase
        .from("company_shareholders" as any)
        .select("id, company_id, user_id, shares")
        .eq("company_id", companyId)
        .order("shares", { ascending: false });

      if (error) throw error;
      const shareholders = (data || []) as unknown as CompanyShareholder[];

      if (shareholders.length === 0) return shareholders;

      const userIds = shareholders.map((shareholder) => shareholder.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id, stage_name, username")
        .in("user_id", userIds as string[]);

      const profileByUserId = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));
      return shareholders.map((shareholder) => ({
        ...shareholder,
        profile: profileByUserId.get(shareholder.user_id) ?? null,
      }));
    },
    enabled: !!companyId,
  });
};

export const useDistributeAnnualProfit = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId }: { companyId: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const gameYear = calculateInGameDate().gameYear;
      const { data: existing } = await supabase
        .from("company_profit_distributions" as any)
        .select("id")
        .eq("company_id", companyId)
        .eq("game_year", gameYear)
        .maybeSingle();

      if (existing) throw new Error("Profit already distributed for this game year");

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("balance")
        .eq("id", companyId)
        .single();
      if (companyError) throw companyError;

      const { data: latestDistribution } = await supabase
        .from("company_profit_distributions" as any)
        .select("distributed_at")
        .eq("company_id", companyId)
        .order("distributed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let transactionQuery = supabase
        .from("company_transactions")
        .select("amount")
        .eq("company_id", companyId);

      if ((latestDistribution as any)?.distributed_at) {
        transactionQuery = transactionQuery.gt(
          "created_at",
          (latestDistribution as any).distributed_at,
        );
      }

      const { data: transactions, error: transactionError } = await transactionQuery;
      if (transactionError) throw transactionError;

      const profit = (transactions || []).reduce(
        (sum, transaction) => sum + Number(transaction.amount),
        0,
      );
      const distributableProfit = Math.max(0, Math.floor(profit));
      if (distributableProfit <= 0) throw new Error("No profit available to distribute");
      if (Number(company.balance) < distributableProfit) {
        throw new Error("Insufficient company balance");
      }

      const { data: shareholders, error: shareholderError } = await supabase
        .from("company_shareholders" as any)
        .select("user_id, shares")
        .eq("company_id", companyId);
      if (shareholderError) throw shareholderError;
      if (!shareholders || shareholders.length === 0) throw new Error("No shareholders found");

      const totalShares = shareholders.reduce(
        (sum: number, shareholder: any) => sum + Number(shareholder.shares),
        0,
      );
      if (totalShares <= 0) throw new Error("Invalid total shares");

      const userIds = shareholders.map((shareholder: any) => shareholder.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id, cash")
        .in("user_id", userIds);

      const profileByUserId = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));

      for (const shareholder of shareholders as any[]) {
        const payout = Math.floor(
          (distributableProfit * Number(shareholder.shares)) / totalShares,
        );
        if (payout <= 0) continue;
        const profile = profileByUserId.get(shareholder.user_id);
        if (!profile) continue;

        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update({ cash: Number(profile.cash) + payout })
          .eq("id", profile.id);
        if (profileUpdateError) throw profileUpdateError;
      }

      const { error: companyUpdateError } = await supabase
        .from("companies")
        .update({ balance: Number(company.balance) - distributableProfit })
        .eq("id", companyId);
      if (companyUpdateError) throw companyUpdateError;

      await supabase.from("company_transactions").insert({
        company_id: companyId,
        transaction_type: "dividend",
        amount: -distributableProfit,
        description: `Annual profit distribution (Game Year ${gameYear})`,
        category: "owner_transfer",
      });

      const { error: distributionError } = await supabase
        .from("company_profit_distributions" as any)
        .insert({
          company_id: companyId,
          game_year: gameYear,
          distributed_profit: distributableProfit,
          distributed_by: user.id,
        });
      if (distributionError) throw distributionError;

      return { distributableProfit, gameYear };
    },
    onSuccess: ({ distributableProfit, gameYear }, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-balance", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-transactions", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-shareholders", variables.companyId] });
      toast({
        title: "Profit distributed",
        description: `${new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: "GBP",
        }).format(distributableProfit)} distributed for game year ${gameYear}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Distribution failed", description: error.message, variant: "destructive" });
    },
  });
};
