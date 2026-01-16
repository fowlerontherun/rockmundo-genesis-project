import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Check, Clock, Loader2, Sparkles } from "lucide-react";
import { useUnderworldStore, type UnderworldProduct } from "@/hooks/useUnderworldStore";

interface PurchaseDialogProps {
  product: UnderworldProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userBalance: number;
}

export const PurchaseDialog = ({
  product,
  open,
  onOpenChange,
  userBalance,
}: PurchaseDialogProps) => {
  const { purchaseProduct } = useUnderworldStore();
  const [isPurchasing, setIsPurchasing] = useState(false);

  if (!product) return null;

  const canAfford = product.price_cash ? userBalance >= product.price_cash : false;
  const remainingBalance = product.price_cash
    ? userBalance - product.price_cash
    : userBalance;

  const effects = product.effects || {};

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      await purchaseProduct.mutateAsync({
        product,
        paymentMethod: "cash",
      });
      onOpenChange(false);
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Confirm Purchase
          </DialogTitle>
          <DialogDescription>
            Review the details before acquiring this item.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="font-semibold">{product.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.description}
            </p>
            {product.lore && (
              <p className="mt-2 text-xs italic text-muted-foreground/70">
                "{product.lore}"
              </p>
            )}
          </div>

          {/* Effects Preview */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Effects</h4>
            <div className="flex flex-wrap gap-2">
              {effects.health && (
                <Badge variant="secondary">+{effects.health} Health</Badge>
              )}
              {effects.energy && (
                <Badge variant="secondary">+{effects.energy} Energy</Badge>
              )}
              {effects.xp && (
                <Badge variant="secondary">+{effects.xp} XP</Badge>
              )}
              {effects.fame && (
                <Badge variant="secondary">+{effects.fame} Fame</Badge>
              )}
              {effects.xp_multiplier && (
                <Badge variant="secondary">
                  +{((effects.xp_multiplier as number) - 1) * 100}% XP Gain
                </Badge>
              )}
              {effects.fame_multiplier && (
                <Badge variant="secondary">
                  +{((effects.fame_multiplier as number) - 1) * 100}% Fame Gain
                </Badge>
              )}
              {effects.energy_regen && (
                <Badge variant="secondary">
                  +{((effects.energy_regen as number) - 1) * 100}% Energy Regen
                </Badge>
              )}
              {effects.all_multiplier && (
                <Badge variant="secondary">
                  +{((effects.all_multiplier as number) - 1) * 100}% All Gains
                </Badge>
              )}
              {effects.skill_slug && effects.skill_xp && (
                <Badge variant="secondary">
                  +{effects.skill_xp}{" "}
                  {String(effects.skill_slug).charAt(0).toUpperCase() +
                    String(effects.skill_slug).slice(1)}{" "}
                  XP
                </Badge>
              )}
            </div>
            {product.duration_hours && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Duration: {product.duration_hours} hours
              </div>
            )}
          </div>

          <Separator />

          {/* Payment Summary */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Balance</span>
              <span>${userBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Item Cost</span>
              <span className="text-destructive">
                -${product.price_cash?.toLocaleString()}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Remaining Balance</span>
              <span className={remainingBalance < 0 ? "text-destructive" : ""}>
                ${remainingBalance.toLocaleString()}
              </span>
            </div>
          </div>

          {!canAfford && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Insufficient funds to complete this purchase.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={!canAfford || isPurchasing}
            className="gap-2"
          >
            {isPurchasing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirm Purchase
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
