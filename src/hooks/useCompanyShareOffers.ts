import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  proposeCompanyShareIssuance,
  respondCompanyShareOffer,
  type CompanyShareOfferResult,
  type CompanyShareOfferStatus,
} from "@/lib/api/companyShareOffers";

export interface CompanyShareOffer {
  id: string;
  company_id: string;
  issuer_profile_id: string;
  recipient_profile_id: string;
  shares: number;
  price_per_share: number;
  total_price: number;
  status: CompanyShareOfferStatus;
  expires_at: string;
  created_at: string;
  issuerProfile?: { id: string; stage_name: string | null; username: string | null } | null;
}

const invalidateShareData = (
  queryClient: ReturnType<typeof useQueryClient>,
  companyId: string,
) => {
  for (const queryKey of [
    ["company-shareholders", companyId],
    ["company-share-offers", companyId],
    ["company", companyId],
    ["companies"],
    ["company-balance", companyId],
    ["company-transactions", companyId],
    ["profile"],
    ["user-cash-balance"],
  ]) {
    queryClient.invalidateQueries({ queryKey });
  }
};

export const useIssueCompanyShares = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: proposeCompanyShareIssuance,
    onSuccess: (result: CompanyShareOfferResult) => {
      invalidateShareData(queryClient, result.companyId);
      toast({
        title: result.status === "accepted" ? "Shares gifted" : "Share offer sent",
        description:
          result.status === "accepted"
            ? `${result.shares.toLocaleString("en-GB")} shares were issued immediately.`
            : `The buyer must accept the ${new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: "GBP",
              }).format(result.totalPrice)} offer before any money moves.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Share offer failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useCompanyShareOffers = (
  companyId: string | undefined,
  recipientProfileId: string | undefined,
) => {
  return useQuery({
    queryKey: ["company-share-offers", companyId, recipientProfileId],
    queryFn: async (): Promise<CompanyShareOffer[]> => {
      if (!companyId || !recipientProfileId) return [];

      const { data: offers, error } = await supabase
        .from("company_share_offers" as any)
        .select(
          "id, company_id, issuer_profile_id, recipient_profile_id, shares, price_per_share, total_price, status, expires_at, created_at",
        )
        .eq("company_id", companyId)
        .eq("recipient_profile_id", recipientProfileId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = (offers || []) as unknown as CompanyShareOffer[];
      if (rows.length === 0) return rows;

      const issuerProfileIds = [...new Set(rows.map((offer) => offer.issuer_profile_id))];
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, stage_name, username")
        .in("id", issuerProfileIds);

      if (profileError) throw profileError;
      const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

      return rows.map((offer) => ({
        ...offer,
        issuerProfile: profileById.get(offer.issuer_profile_id) ?? null,
      }));
    },
    enabled: !!companyId && !!recipientProfileId,
  });
};

export const useRespondToCompanyShareOffer = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: respondCompanyShareOffer,
    onSuccess: (result: CompanyShareOfferResult) => {
      invalidateShareData(queryClient, result.companyId);
      toast({
        title: result.status === "accepted" ? "Share offer accepted" : "Share offer declined",
        description:
          result.status === "accepted"
            ? `${result.shares.toLocaleString("en-GB")} shares were added to your holding for ${new Intl.NumberFormat(
                "en-GB",
                { style: "currency", currency: "GBP" },
              ).format(result.totalPrice)}.`
            : "No money or shares were transferred.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not respond to offer",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
