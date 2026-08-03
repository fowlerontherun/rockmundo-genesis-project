import { Banknote, Wallet, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { BandPaymentSource } from "@/hooks/useBandPaymentSource";

interface BandPaymentSourceSelectorProps {
  cost: number;
  source: BandPaymentSource;
  onChange: (source: BandPaymentSource) => void;
  bandBalance: number;
  personalBalance: number;
  bandName?: string | null;
  disabled?: boolean;
  className?: string;
}

const money = (value: number) =>
  `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Shows which wallet is paying for a band activity. Band funds are the default;
 * the player can override to pay from their own pocket instead.
 */
export const BandPaymentSourceSelector = ({
  cost,
  source,
  onChange,
  bandBalance,
  personalBalance,
  bandName,
  disabled,
  className,
}: BandPaymentSourceSelectorProps) => {
  const options: Array<{
    key: BandPaymentSource;
    label: string;
    balance: number;
    icon: typeof Banknote;
  }> = [
    { key: "band", label: bandName ? `${bandName} funds` : "Band funds", balance: bandBalance, icon: Banknote },
    { key: "personal", label: "My personal funds", balance: personalBalance, icon: Wallet },
  ];

  const active = options.find((option) => option.key === source)!;
  const insufficient = cost > 0 && active.balance < cost;

  return (
    <div className={cn("space-y-2 rounded-lg border bg-muted/40 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Paying with
        </span>
        <Badge variant={source === "band" ? "secondary" : "default"} className="text-[10px]">
          {source === "band" ? "Band default" : "Player override"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = option.key === source;
          return (
            <button
              key={option.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.key)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-accent/40",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  cost > 0 && option.balance < cost
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {money(option.balance)} available
              </span>
            </button>
          );
        })}
      </div>

      {source === "personal" && (
        <p className="text-[11px] text-muted-foreground">
          Your money is paid into the band treasury and spent on this booking, so it
          stays on the band&apos;s finance record.
        </p>
      )}

      {insufficient && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {money(cost - active.balance)} short — switch source or top up.
        </p>
      )}
    </div>
  );
};
