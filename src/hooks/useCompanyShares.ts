import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { distributeCompanyAnnualProfit } from "@/lib/api/companyProfitDistributions";

export { useIssueCompanyShares } from "@/hooks/useCompanyShareOffers";

type ShareholderPublicProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
};

export interface CompanyShareholder {
  id: string;
  company_id: string;
  user_id: string;
  shares: number;
  profile?: ShareholderPublicProfile | null;
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
      const { data: profiles, error: profileError } = await supabase
        .from("public_profiles")
        .select("id, user_id, display_name, username")
        .in("user_id", userIds);

      if (profileError) throw profileError;
      const publicProfiles = (profiles || []) as ShareholderPublicProfile[];
      const profileByUserId = new Map(
        publicProfiles.map((profile) => [profile.user_id, profile]),
      );

      return shareholders.map((shareholder) => ({
        ...shareholder,
        profile: profileByUserId.get(shareholder.user_id) ?? null,
      }));
    },
    enabled: !!companyId,
  });
};

const formatGBP = (amount: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);

export const useDistributeAnnualProfit = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId }: { companyId: string }) =>
      distributeCompanyAnnualProfit(companyId),
    onSuccess: ({ distributedProfit, gameYear }, variables) => {
      for (const queryKey of [
        ["company", variables.companyId],
        ["company-balance", variables.companyId],
        ["company-transactions", variables.companyId],
        ["company-income-expenses", variables.companyId],
        ["company-shareholders", variables.companyId],
        ["company-financial-summary"],
        ["companies"],
        ["profile"],
        ["user-cash-balance"],
        ["financial-ledger-history"],
      ]) {
        queryClient.invalidateQueries({ queryKey });
      }

      toast({
        title: "Profit distributed",
        description: `${formatGBP(distributedProfit)} distributed for game year ${gameYear}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Distribution failed", description: error.message, variant: "destructive" });
    },
  });
};
