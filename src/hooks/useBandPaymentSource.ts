import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fundBandFromWallet,
  getBandTreasuryDashboard,
} from "@/services/finance/atomicBookingClient";

export type BandPaymentSource = "band" | "personal";

// Rehearsal booking used to top up the band before the booking hook ran. The
// atomic rehearsal RPC now charges the selected payer itself, but the existing
// dialog and page are intentionally kept stable. Preserve that payer choice
// in-memory across the dialog -> page -> hook boundary and consume it once.
const pendingAtomicRehearsalSources = new Map<string, BandPaymentSource>();

export function consumeAtomicRehearsalPaymentSource(
  bandId: string,
): BandPaymentSource {
  const source = pendingAtomicRehearsalSources.get(bandId) ?? "band";
  pendingAtomicRehearsalSources.delete(bandId);
  return source;
}

/**
 * Shared payer resolution for band activities that cost money.
 *
 * Band funds are always the default. Spendability is read from the canonical
 * band treasury dashboard (available balance = balance minus reservations).
 * We deliberately do not fall back to bands.band_balance for booking decisions:
 * that column is only a compatibility mirror for legacy screens.
 */
export function useBandPaymentSource(bandId: string | null | undefined) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [source, setSource] = useState<BandPaymentSource>("band");

  useEffect(() => {
    setSource("band");
  }, [bandId]);

  const { data: bandRow, isLoading: isBandFundingLoading } = useQuery({
    queryKey: ["band-payment-source-band", bandId],
    queryFn: async () => {
      if (!bandId) return null;

      const [bandResult, dashboard] = await Promise.all([
        supabase
          .from("bands")
          .select("id, name")
          .eq("id", bandId)
          .maybeSingle(),
        getBandTreasuryDashboard(bandId),
      ]);

      const band = bandResult.data;
      if (!band) return null;

      const primaryTreasury =
        dashboard?.treasuries.find((treasury) => treasury.isPrimary) ??
        dashboard?.treasuries[0];

      const treasuryAvailable =
        dashboard?.status === "ok" && primaryTreasury
          ? primaryTreasury.availableBalanceMinor / 100
          : null;

      return {
        ...band,
        treasury_available: treasuryAvailable,
        treasury_status: dashboard?.status ?? "treasury_missing",
      };
    },
    enabled: !!bandId,
    staleTime: 15_000,
  });

  const { data: profileRow, isLoading: isPersonalFundingLoading } = useQuery({
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

  const treasuryMissing =
    !!bandId && !isBandFundingLoading && bandRow?.treasury_status !== "ok";

  // -1 is an intentional UI sentinel for a missing treasury. It keeps legacy
  // consumers fail-closed while allowing BandPaymentSourceSelector to show a
  // recovery action instead of pretending a missing treasury is simply £/$0.
  const bandBalance = treasuryMissing
    ? -1
    : Number(bandRow?.treasury_available ?? 0);
  const personalBalance = Number(profileRow?.cash ?? 0);

  const canAfford = useCallback(
    (cost: number) => {
      if (source === "band") {
        return !treasuryMissing && bandBalance >= cost;
      }
      return personalBalance >= cost;
    },
    [source, treasuryMissing, bandBalance, personalBalance],
  );

  /**
   * Ensures legacy band-authoritative activities have enough treasury funds.
   * Returns the amount (if any) moved from the player's wallet.
   *
   * Rehearsal bookings are server-atomic and therefore deliberately skip the
   * pre-funding step. The selected payer is consumed by `useRehearsalBooking`.
   */
  const prepareFunds = useCallback(
    async (cost: number, note?: string) => {
      if (bandId && note?.startsWith("Rehearsal booking")) {
        pendingAtomicRehearsalSources.set(bandId, source);
        return 0;
      }

      if (!bandId || source !== "personal" || cost <= 0) return 0;

      // Missing treasury behaves as a zero balance here. fundBandFromWallet is
      // the approved recovery path and creates the treasury before crediting it.
      const availableBandBalance = Math.max(0, bandBalance);
      const shortfall = Math.max(0, cost - availableBandBalance);
      const topUp = Math.ceil(shortfall);
      if (topUp <= 0) return 0;

      if (personalBalance < topUp) {
        throw new Error(
          `Your personal funds are short by $${(topUp - personalBalance).toFixed(2)}.`,
        );
      }

      const { error } = await fundBandFromWallet(
        bandId,
        topUp * 100,
        note ?? "Personal funds used for band activity",
      );
      if (error) {
        throw new Error(
          error.message?.includes("insufficient")
            ? "There is not enough money in your personal wallet."
            : error.message || "Could not use your personal funds.",
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["band-payment-source-band", bandId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["band-payment-source-profile", profileId],
        }),
      ]);

      return topUp;
    },
    [
      bandId,
      source,
      bandBalance,
      personalBalance,
      profileId,
      queryClient,
    ],
  );

  return useMemo(
    () => ({
      source,
      setSource,
      bandName: bandRow?.name ?? null,
      bandBalance,
      personalBalance,
      treasuryMissing,
      treasuryStatus: bandRow?.treasury_status ?? null,
      isLoading: isBandFundingLoading || isPersonalFundingLoading,
      canAfford,
      prepareFunds,
    }),
    [
      source,
      bandRow?.name,
      bandRow?.treasury_status,
      bandBalance,
      personalBalance,
      treasuryMissing,
      isBandFundingLoading,
      isPersonalFundingLoading,
      canAfford,
      prepareFunds,
    ],
  );
}
