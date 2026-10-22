import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { marketUpgradeCost, marketUpgradeCooldownUntil } from "./marketUpgradeModel";

interface MarketLevel {
  city_id: string;
  level: number;
  total_invested: number;
  last_upgraded_at: string | null;
}
interface MayorInfo { id: string }
interface Treasury { balance: number; pending_commitments: number }
interface UpgradeResponse {
  status: "completed" | "already_completed";
  newLevel: number;
  cost: number;
  newVarieties?: number;
}
export function CookingMarketMayorUpgrade({ cityId, profileId, marketOpen }: {
  cityId: string;
  profileId: string | null;
  marketOpen: boolean;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const retryKey = useRef<string | null>(null);
  const mayor = useQuery({
    queryKey: ["cooking-market-mayor", cityId, profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("city_mayors")
        .select("id").eq("city_id", cityId).eq("profile_id", profileId)
        .eq("is_current", true).limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as MayorInfo | null;
    },
  });
  const level = useQuery({
    queryKey: ["cooking-market-level", cityId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cooking_city_market_levels")
        .select("city_id,level,total_invested,last_upgraded_at")
        .eq("city_id", cityId).single();
      if (error) throw error;
      return data as MarketLevel;
    },
  });
  const treasury = useQuery({
    queryKey: ["city-treasury", cityId],
    enabled: Boolean(mayor.data),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("city_treasury")
        .select("balance,pending_commitments").eq("city_id", cityId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as Treasury | null;
    },
  });
  const upgrade = useMutation({
    mutationFn: async () => {
      if (!profileId || !mayor.data || !marketOpen) throw new Error("Market upgrades are unavailable");
      const id = retryKey.current ?? crypto.randomUUID();
      retryKey.current = id;
      const { data, error } = await (supabase as any).rpc("upgrade_cooking_city_market", {
        p_city_id: cityId, p_profile_id: profileId, p_request_id: id,
      });
      if (error) throw error;
      retryKey.current = null;
      return data as UpgradeResponse;
    },
    onSuccess: (result) => {
      setMessage(`Market upgraded to level ${result.newLevel} for $${result.cost.toLocaleString()} from the city treasury.`);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cooking-market-level", cityId] }),
        queryClient.invalidateQueries({ queryKey: ["city-treasury", cityId] }),
        queryClient.invalidateQueries({ queryKey: ["cooking-city-market", cityId] }),
      ]);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const currentLevel = level.data?.level ?? 1;
  const nextCost = marketUpgradeCost(currentLevel);
  const deadline = marketUpgradeCooldownUntil(level.data?.last_upgraded_at ?? null);
  const cooldown = deadline !== null && Date.now() < deadline;
  const availableBudget = treasury.data
    ? Math.max(0, Number(treasury.data.balance) - Number(treasury.data.pending_commitments)) : null;
  const canUpgrade = Boolean(mayor.data && marketOpen && nextCost !== null
    && !cooldown && availableBudget !== null && availableBudget >= nextCost && !upgrade.isPending);

  return <section aria-label="Cooking market investment" className="rounded-lg border p-4 space-y-2">
    <h4 className="flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4" />Market improvements</h4>
    {level.isLoading && <p className="text-sm">Loading market improvements…</p>}
    {level.isError && <p role="alert" className="text-sm">Market upgrade information is unavailable.</p>}
    {level.data && <p className="text-sm">
      Current level: {currentLevel}/5. Higher levels improve produce quality, stock capacity and ingredient variety.
    </p>}
    {!marketOpen && <p className="text-xs text-muted-foreground">
      Improvements will unlock when this city's ingredient market opens. No treasury money will be spent before then.
    </p>}
    {mayor.isError && <p role="alert" className="text-sm">Mayor permissions could not be checked.</p>}
    {mayor.data && level.data && <>
      {nextCost !== null
        ? <p className="text-sm">Next level costs ${nextCost.toLocaleString()} from the city treasury.</p>
        : <p className="text-sm">This market has reached the maximum upgrade level.</p>}
      {cooldown && <p className="text-xs text-muted-foreground">
        Next mayor upgrade available {new Date(deadline!).toLocaleString()}.
      </p>}
      {availableBudget !== null && <p className="text-xs text-muted-foreground">
        Available treasury budget: ${availableBudget.toLocaleString()}.
      </p>}
      <Button type="button" size="sm" disabled={!canUpgrade} onClick={() => upgrade.mutate()}>
        {upgrade.isPending ? "Investing…" : nextCost === null ? "Fully upgraded" : `Upgrade to level ${currentLevel + 1}`}
      </Button>
      {message && <p className="text-sm" role="status">{message}</p>}
    </>}
  </section>;
}
