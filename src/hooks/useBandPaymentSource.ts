import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type BandPaymentSource = "band" | "personal";

/**
 * Shared payer resolution for band activities that cost money.
 *
 * Band funds are always the default. When the player overrides with their own
 * personal wallet, the money is routed into the band treasury first (an ordinary
 * band contribution) so that the underlying booking engines — which are
 * band-authoritative — remain unchanged and auditable.
 */
export function useBandPaymentSource(bandId: string | null | undefined) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [source, setSource] = useState<BandPaymentSource>("band");

  useEffect(() => {
    setSource("band");
  }, [bandId]);

  const { data: bandRow } = useQuery({
    queryKey: ["band-payment-source-band", bandId],
    queryFn: async () => {
      if (!bandId) return null;
      const { data } = await supabase
        .from("bands")
        .select("id, name, band_balance")
        .eq("id", bandId)
        .maybeSingle();
      return data;
    },
    enabled: !!bandId,
    staleTime: 15_000,
  });

  const { data: profileRow } = useQuery({
    queryKey: ["band-payment-source-profile", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, cash")
        .eq("id", profileId)
        .maybeSingle();
      return data;
    },
    enabled: !!profileId,
    staleTime: 15_000,
  });

  const bandBalance = Number(bandRow?.band_balance ?? 0);
  const personalBalance = Number(profileRow?.cash ?? 0);

  const canAfford = useCallback(
    (cost: number) =>
      source === "band" ? bandBalance >= cost : personalBalance >= cost,
    [source, bandBalance, personalBalance],
  );

  /**
   * Ensures the band treasury holds enough money for `cost`.
   * Returns the amount (if any) moved from the player's wallet.
   */
  const prepareFunds = useCallback(
    async (cost: number, note?: string) => {
      if (!bandId || source !== "personal" || cost <= 0) return 0;

      const shortfall = Math.max(0, cost - bandBalance);
      const topUp = Math.ceil(shortfall);
      if (topUp <= 0) return 0;

      if (personalBalance < topUp) {
        throw new Error(
          `Your personal funds are short by $${(topUp - personalBalance).toFixed(2)}.`,
        );
      }

      const { error } = await (supabase as any).rpc("fund_my_band", {
        p_band_id: bandId,
        p_source_kind: "wallet",
        p_source_account_id: null,
        p_amount_minor: topUp * 100,
        p_note: note ?? "Personal funds used for band activity",
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) {
        throw new Error(
          error.message?.includes("insufficient")
            ? "There is not enough money in your personal wallet."
            : error.message || "Could not use your personal funds.",
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["band-payment-source-band", bandId] }),
        queryClient.invalidateQueries({ queryKey: ["band-payment-source-profile", profileId] }),
      ]);

      return topUp;
    },
    [bandId, source, bandBalance, personalBalance, profileId, queryClient],
  );

  return useMemo(
    () => ({
      source,
      setSource,
      bandName: bandRow?.name ?? null,
      bandBalance,
      personalBalance,
      canAfford,
      prepareFunds,
    }),
    [source, bandRow?.name, bandBalance, personalBalance, canAfford, prepareFunds],
  );
}
