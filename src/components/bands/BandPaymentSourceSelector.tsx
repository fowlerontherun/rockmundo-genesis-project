import { AlertCircle, Banknote, ExternalLink, Wallet } from "lucide-react";
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
  `$${Math.max(0, Number(value || 0)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;

/**
 * Shows which wallet is paying for a band activity. Band funds are the default;
 * the player can explicitly override to personal funding where the activity
 * supports it.
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
  const treasuryMissing = bandBalance < 0;
  const safeBandBalance = treasuryMissing ? 0 : bandBalance;

  const options: Array<{
    key: BandPaymentSource;
    label: string;
    balance: number;
    icon: typeof Banknote;
    unavailable?: boolean;
  }> = [
    {
      key: "band",
      label: bandName ? `${bandName} funds` : "Band funds",
      balance: safeBandBalance,
      icon: Banknote,
      unavailable: treasuryMissing,
    },
    {
      key: "personal",
      label: "My personal funds",
      balance: personalBalance,
      icon: Wallet,
    },
  ];

  const active = options.find((option) => option.key === source)!;
  const insufficient =
    cost > 0 && (active.unavailable || active.balance < cost);
  const shortfall = Math.max(0, cost - active.balance);

  return (
    <div className={cn("space-y-2 rounded-lg border bg-muted/40 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Paying with
        </span>
        <Badge
          variant={source === "band" ? "secondary" : "default"}
          className="text-[10px]"
        >
          {source === "band" ? "Band default" : "Player override"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = option.key === source;
          const cannotCoverCost =
            cost > 0 && (option.unavailable || option.balance < cost);

          return (
            <button
              key={option.key}
              type="button"
              disabled={disabled || option.unavailable}
              onClick={() => onChange(option.key)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-accent/40",
                (disabled || option.unavailable) &&
                  "cursor-not-allowed opacity-60",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  cannotCoverCost ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {option.unavailable
                  ? "Treasury unavailable"
                  : `${money(option.balance)} available`}
              </span>
            </button>
          );
        })}
      </div>

      {cost > 0 && !active.unavailable && (
        <div className="rounded-md bg-background/70 px-2.5 py-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {source === "band" ? "Band treasury" : "Personal wallet"}
          </span>{" "}
          will be charged {money(cost)} if the booking is confirmed. Expected
          balance after payment: {money(active.balance - cost)}.
        </div>
      )}

      {source === "personal" && (
        <p className="text-[11px] text-muted-foreground">
          Personal funding is recorded against the band activity so the finance
          history shows who actually covered the cost or required shortfall.
        </p>
      )}

      {treasuryMissing && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
          <p className="flex items-start gap-1.5 text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              This band does not currently have an available treasury. Band-funded
              bookings are disabled until it is created or funded.
            </span>
          </p>
          <a
            href="/finances"
            className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Open Band Finances <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {insufficient && !active.unavailable && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {money(shortfall)} short — switch funding source or add funds before
          confirming.
        </p>
      )}
    </div>
  );
};
