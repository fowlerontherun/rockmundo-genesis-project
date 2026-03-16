import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/components/ui/use-toast";

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
      const shareholders = (data || []) as CompanyShareholder[];

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
        const { error: updateSharesError } = await supabase
          .from("company_shareholders" as any)
          .update({ shares: Number(existingShareholder.shares) + shares })
          .eq("id", existingShareholder.id);
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

      const { data, error } = await supabase.rpc("distribute_company_annual_profit", {
        p_company_id: companyId,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result) throw new Error("Distribution failed");

      return {
        distributableProfit: Number(result.distributed_profit),
        gameYear: Number(result.game_year),
      };
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
