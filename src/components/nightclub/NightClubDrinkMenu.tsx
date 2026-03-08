import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassWater, Loader2 } from "lucide-react";
import type { NightClubDrink } from "@/utils/worldEnvironment";

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
  onBuyDrink,
  disabled,
  buyingId,
}: NightClubDrinkMenuProps) => {
  if (!drinks.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <GlassWater className="h-4 w-4 text-primary" /> Drink Menu
      </div>
      <div className="grid gap-2">
        {drinks.map((drink) => (
          <div
            key={drink.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{drink.name}</span>
                {drink.price !== null && (
                  <Badge variant="outline" className="text-xs">
                    {currencyFormatter.format(drink.price)}
                  </Badge>
                )}
              </div>
              {drink.effect && (
                <p className="text-xs text-muted-foreground mt-0.5">{drink.effect}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onBuyDrink(drink)}
              disabled={disabled || buyingId === drink.id}
            >
              {buyingId === drink.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Buy"
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
