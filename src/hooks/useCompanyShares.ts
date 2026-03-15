import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/components/ui/use-toast";
import { calculateInGameDate } from "@/utils/gameCalendar";

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

      const userIds = shareholders.map((s) => s.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id, stage_name, username")
        .in("user_id", userIds as string[]);

      const profileByUserId = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return shareholders.map((s) => ({ ...s, profile: profileByUserId.get(s.user_id) ?? null }));
    },
    enabled: !!companyId,
  });
};

export const useIssueCompanyShares = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      recipientProfileId,
      shares,
      pricePerShare,
    }: {
      companyId: string;
      recipientProfileId: string;
      shares: number;
      pricePerShare: number;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");
      if (shares <= 0) throw new Error("Shares must be greater than 0");
      if (pricePerShare < 0) throw new Error("Price per share cannot be negative");

      const { data: recipient, error: recipientError } = await supabase
        .from("profiles")
        .select("id, user_id, cash")
        .eq("id", recipientProfileId)
        .single();

      if (recipientError) throw recipientError;
      const totalPrice = shares * pricePerShare;

      if (totalPrice > 0) {
        if ((recipient.cash || 0) < totalPrice) {
          throw new Error("Recipient does not have enough cash to buy these shares");
        }

        const { error: buyerCashError } = await supabase
          .from("profiles")
          .update({ cash: Number(recipient.cash) - totalPrice })
          .eq("id", recipient.id);
        if (buyerCashError) throw buyerCashError;

        const { data: company, error: companyError } = await supabase
          .from("companies")
          .select("balance")
          .eq("id", companyId)
          .single();
        if (companyError) throw companyError;

        const { error: companyUpdateError } = await supabase
          .from("companies")
          .update({ balance: Number(company.balance) + totalPrice })
          .eq("id", companyId);
        if (companyUpdateError) throw companyUpdateError;

        await supabase.from("company_transactions").insert({
          company_id: companyId,
          transaction_type: "income",
          amount: totalPrice,
          description: `Share sale (${shares} shares)` ,
          category: "owner_transfer",
        });
      }

      const { data: existingShareholder } = await supabase
        .from("company_shareholders" as any)
        .select("id, shares")
        .eq("company_id", companyId)
        .eq("user_id", recipient.user_id)
        .maybeSingle();

      if (existingShareholder) {
        const existing = existingShareholder as any;
        const { error: updateSharesError } = await supabase
          .from("company_shareholders" as any)
          .update({ shares: Number(existing.shares) + shares })
          .eq("id", existing.id);
        if (updateSharesError) throw updateSharesError;
      } else {
        const { error: insertSharesError } = await supabase
          .from("company_shareholders" as any)
          .insert({ company_id: companyId, user_id: recipient.user_id, shares });
        if (insertSharesError) throw insertSharesError;
      }

      await supabase.from("company_share_transfers" as any).insert({
        company_id: companyId,
        from_user_id: user.id,
        to_user_id: recipient.user_id,
        shares,
        price_per_share: pricePerShare,
        total_price: totalPrice,
        transfer_type: totalPrice > 0 ? "sale" : "gift",
      });

      const { data: allShareholders } = await supabase
        .from("company_shareholders" as any)
        .select("user_id, shares")
        .eq("company_id", companyId)
        .order("shares", { ascending: false })
        .limit(1);

      if (allShareholders && allShareholders.length > 0) {
        await supabase
          .from("companies")
          .update({ owner_id: allShareholders[0].user_id })
          .eq("id", companyId);
      }

      return { totalPrice };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["company-shareholders", vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company", vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company-balance", vars.companyId] });
      toast({
        title: "Shares created",
        description: "Shares were successfully created and transferred.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Share transfer failed", description: error.message, variant: "destructive" });
    },
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

      const { data: latestDist } = await supabase
        .from("company_profit_distributions" as any)
        .select("distributed_at")
        .eq("company_id", companyId)
        .order("distributed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let txQuery = supabase
        .from("company_transactions")
        .select("amount")
        .eq("company_id", companyId);

      if (latestDist?.distributed_at) {
        txQuery = txQuery.gt("created_at", latestDist.distributed_at);
      }

      const { data: txns, error: txError } = await txQuery;
      if (txError) throw txError;

      const profit = (txns || []).reduce((sum, t) => sum + Number(t.amount), 0);
      const distributableProfit = Math.max(0, Math.floor(profit));
      if (distributableProfit <= 0) throw new Error("No profit available to distribute");
      if (Number(company.balance) < distributableProfit) throw new Error("Insufficient company balance");

      const { data: shareholders, error: shError } = await supabase
        .from("company_shareholders" as any)
        .select("user_id, shares")
        .eq("company_id", companyId);
      if (shError) throw shError;
      if (!shareholders || shareholders.length === 0) throw new Error("No shareholders found");

      const totalShares = shareholders.reduce((sum: number, sh: any) => sum + Number(sh.shares), 0);
      if (totalShares <= 0) throw new Error("Invalid total shares");

      const userIds = shareholders.map((s: any) => s.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id, cash")
        .in("user_id", userIds);

      const profileByUserId = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      for (const sh of shareholders as any[]) {
        const payout = Math.floor((distributableProfit * Number(sh.shares)) / totalShares);
        if (payout <= 0) continue;
        const profile = profileByUserId.get(sh.user_id);
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

      const { error: distError } = await supabase
        .from("company_profit_distributions" as any)
        .insert({
          company_id: companyId,
          game_year: gameYear,
          distributed_profit: distributableProfit,
          distributed_by: user.id,
        });
      if (distError) throw distError;

      return { distributableProfit, gameYear };
    },
    onSuccess: ({ distributableProfit, gameYear }, vars) => {
      queryClient.invalidateQueries({ queryKey: ["company", vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-balance", vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-transactions", vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-shareholders", vars.companyId] });
      toast({
        title: "Profit distributed",
        description: `$${distributableProfit.toLocaleString()} distributed for game year ${gameYear}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Distribution failed", description: error.message, variant: "destructive" });
    },
  });
};
