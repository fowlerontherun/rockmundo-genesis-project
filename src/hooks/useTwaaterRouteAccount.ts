import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type TwaaterAccountLike = {
  id: string;
  owner_type: string;
  owner_id?: string | null;
  display_name: string;
  handle: string;
  verified?: boolean | null;
  follower_count?: number | null;
  following_count?: number | null;
  fame_score?: number | null;
};

export const useTwaaterRouteAccount = (
  fallbackAccount?: TwaaterAccountLike | null,
  requestedAccountId?: string | null,
) => {
  const shouldResolveRequested =
    Boolean(requestedAccountId) &&
    Boolean(fallbackAccount?.id) &&
    requestedAccountId !== fallbackAccount?.id;

  const query = useQuery({
    queryKey: ["twaater-route-account", requestedAccountId, fallbackAccount?.id],
    queryFn: async () => {
      if (!requestedAccountId) return null;

      const { data: isMine, error: ownershipError } = await (supabase.rpc as any)(
        "twaater_account_is_mine",
        { _account_id: requestedAccountId },
      );

      if (ownershipError) throw ownershipError;
      if (!isMine) return null;

      const { data, error } = await supabase
        .from("twaater_accounts")
        .select("id, owner_type, owner_id, display_name, handle, verified, follower_count, following_count, fame_score")
        .eq("id", requestedAccountId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: shouldResolveRequested,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const requestedAccount =
    shouldResolveRequested && !query.isLoading && query.data ? query.data : null;

  return {
    account: requestedAccount || fallbackAccount || null,
    isLoading: shouldResolveRequested && query.isLoading,
    error: query.error,
    requestedAccountValid: !shouldResolveRequested || Boolean(query.data),
  };
};
