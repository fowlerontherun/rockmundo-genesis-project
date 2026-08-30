import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCheckoutCurrency } from "@/hooks/useCheckoutCurrency";
import { CHECKOUT_CURRENCIES, CURRENCY_META } from "@/lib/checkoutCurrency";

interface CurrencySelectorProps {
  className?: string;
  showLabel?: boolean;
}

export function CurrencySelector({ className, showLabel = true }: CurrencySelectorProps) {
  const { currency, setCurrency } = useCheckoutCurrency();

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {showLabel && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          Pay in
        </span>
      )}
      <div className="flex items-center gap-1 rounded-md border border-border bg-card/60 p-1">
        {CHECKOUT_CURRENCIES.map((code) => (
          <Button
            key={code}
            type="button"
            size="sm"
            variant={currency === code ? "default" : "ghost"}
            className="h-7 px-2 text-xs"
            aria-pressed={currency === code}
            aria-label={`Pay in ${CURRENCY_META[code].name}`}
            onClick={() => setCurrency(code)}
          >
            {CURRENCY_META[code].symbol} {CURRENCY_META[code].label}
          </Button>
        ))}
      </div>
    </div>
  );
}
