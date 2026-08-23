import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassWater, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { NightClubDrink } from "@/utils/worldEnvironment";
import { buyAuthoritativeNightclubDrink, fetchNightclubPolicy } from "@/hooks/useNightlifeEvents";

interface NightClubDrinkMenuProps {
  drinks: NightClubDrink[];
  onBuyDrink: (drink: NightClubDrink) => void;
  disabled?: boolean;
  buyingId?: string | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const NightClubDrinkMenu = ({
  drinks,
  disabled,
  buyingId,
}: NightClubDrinkMenuProps) => {
  const { clubId } = useParams<{ clubId: string }>();
  const queryClient = useQueryClient();
  const [authoritativeBuyingId, setAuthoritativeBuyingId] = useState<string | null>(null);
  const { data: policy, isLoading: policyLoading } = useQuery({
    queryKey: ["nightclub-policy", clubId],
    queryFn: () => fetchNightclubPolicy(clubId!),
    enabled: Boolean(clubId),
    staleTime: 60_000,
  });

  if (!drinks.length) return null;

  const handleBuy = async (drink: NightClubDrink) => {
    if (!clubId) {
      toast.error("Nightclub context is unavailable");
      return;
    }
    setAuthoritativeBuyingId(drink.id);
    try {
      const outcome = await buyAuthoritativeNightclubDrink(clubId, drink.id);
      toast.success(outcome.message);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["addictions"] });
      queryClient.invalidateQueries({ queryKey: ["nightclub-policy", clubId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Drink purchase failed");
    } finally {
      setAuthoritativeBuyingId(null);
    }
  };

  const serviceBlocked = policy?.alcoholAccess === false;
  const activeBuyingId = authoritativeBuyingId ?? buyingId;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GlassWater className="h-4 w-4 text-primary" /> Drink Menu
        </div>
        {policy && (
          <Badge variant={serviceBlocked ? "destructive" : "outline"} className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            City drinking age {policy.alcoholLegalAge} · {policy.drugPolicy} drug policy
          </Badge>
        )}
      </div>
      {serviceBlocked && policy && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          City Hall law blocks alcohol service: this character is {policy.playerAge}, while the legal drinking age is {policy.alcoholLegalAge}.
        </p>
      )}
      <div className="grid gap-2">
        {drinks.map((drink) => (
          <div key={drink.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{drink.name}</span>
                {drink.price !== null && (
                  <Badge variant="outline" className="text-xs">
                    {currencyFormatter.format(drink.price)}
                  </Badge>
                )}
              </div>
              {drink.effect && <p className="text-xs text-muted-foreground mt-0.5">{drink.effect}</p>}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBuy(drink)}
              disabled={disabled || policyLoading || serviceBlocked || activeBuyingId === drink.id || !clubId}
            >
              {activeBuyingId === drink.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Buy"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
