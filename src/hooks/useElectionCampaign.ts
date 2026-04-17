import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type {
  CampaignCategory,
  CampaignExpenditure,
  ElectionNewsArticle,
} from "@/types/political-party";

export function useCampaignExpenditures(candidateId: string | undefined) {
  return useQuery({
    queryKey: ["campaign-expenditures", candidateId],
    queryFn: async () => {
      if (!candidateId) return [];
      const { data, error } = await supabase
        .from("campaign_expenditures")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CampaignExpenditure[];
    },
    enabled: !!candidateId,
  });
}

export function useElectionArticles(electionId: string | undefined) {
  return useQuery({
    queryKey: ["election-articles", electionId],
    queryFn: async () => {
      if (!electionId) return [];
      const { data, error } = await supabase
        .from("election_news_articles")
        .select("*")
        .eq("election_id", electionId)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ElectionNewsArticle[];
    },
    enabled: !!electionId,
  });
}

export function useRecentElectionArticles(limit = 8) {
  return useQuery({
    queryKey: ["election-articles-recent", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("election_news_articles")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ElectionNewsArticle[];
    },
  });
}

export function usePublishCampaignArticle() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (input: {
      election_id: string;
      candidate_id: string;
      headline: string;
      body: string;
    }) => {
      if (!profileId) throw new Error("Sign in first");
      const { error } = await supabase.from("election_news_articles").insert({
        election_id: input.election_id,
        candidate_id: input.candidate_id,
        author_profile_id: profileId,
        headline: input.headline,
        body: input.body,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success("Article published");
      queryClient.invalidateQueries({ queryKey: ["election-articles", vars.election_id] });
      queryClient.invalidateQueries({ queryKey: ["election-articles-recent"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLogCampaignSpend() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (input: {
      candidate_id: string;
      category: CampaignCategory;
      amount: number;
      funded_from?: "personal" | "party";
      party_id?: string | null;
    }) => {
      if (!profileId) throw new Error("Sign in first");
      const effect = Math.floor(input.amount / 1000); // $10 per "effect" point
      const { error } = await supabase.from("campaign_expenditures").insert({
        candidate_id: input.candidate_id,
        spender_profile_id: profileId,
        category: input.category,
        amount: input.amount,
        effect_value: effect,
        funded_from: input.funded_from ?? "personal",
        party_id: input.party_id ?? null,
      });
      if (error) throw error;
      // increment cached total on candidate
      const { data: cur } = await supabase
        .from("city_candidates")
        .select("campaign_spend_total")
        .eq("id", input.candidate_id)
        .maybeSingle();
      const newTotal = (cur?.campaign_spend_total ?? 0) + input.amount;
      await supabase
        .from("city_candidates")
        .update({ campaign_spend_total: newTotal })
        .eq("id", input.candidate_id);
    },
    onSuccess: (_, vars) => {
      toast.success("Spend logged");
      queryClient.invalidateQueries({ queryKey: ["campaign-expenditures", vars.candidate_id] });
      queryClient.invalidateQueries({ queryKey: ["election-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
