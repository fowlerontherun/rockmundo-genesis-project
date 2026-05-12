import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Coins, Gem, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CASH_PER_TOKEN = 10_000;
const PRESETS = [10, 50, 100, 250];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cash: number;
  tokens: number;
}

export function BuyGemsDialog({ open, onOpenChange, cash, tokens }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);

  const cost = useMemo(() => amount * CASH_PER_TOKEN, [amount]);
  const canAfford = cash >= cost && amount > 0;

  const onConfirm = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("buy-premium-tokens", {
        body: { tokens: amount },
      });
      if (error) throw error;
      if (data?.error) {
        toast({
          title: data.error === "INSUFFICIENT_FUNDS" ? "Not enough cash" : "Could not buy gems",
          description: data.message ?? data.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Gems purchased",
        description: `+${data.tokens_added} tokens for $${data.cash_spent.toLocaleString()}.`,
      });
      qc.invalidateQueries({ queryKey: ["active-profile"] });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Could not buy gems",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gem className="h-5 w-5 text-purple-400" /> Buy Premium Tokens
          </DialogTitle>
          <DialogDescription>
            Convert in-game cash into premium tokens at $
            {CASH_PER_TOKEN.toLocaleString()} per token.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border bg-muted/30 p-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Coins className="h-3.5 w-3.5" /> Cash
              </span>
              <span className="font-semibold tabular-nums">${cash.toLocaleString()}</span>
            </div>
            <div className="rounded-md border bg-muted/30 p-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Gem className="h-3.5 w-3.5 text-purple-400" /> Tokens
              </span>
              <span className="font-semibold tabular-nums">{tokens}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <Button
                key={p}
                variant={amount === p ? "default" : "outline"}
                size="sm"
                className="h-7"
                onClick={() => setAmount(p)}
              >
                {p}
              </Button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tokens to buy</label>
            <Input
              type="number"
              min={1}
              max={500}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Math.min(500, Math.floor(Number(e.target.value) || 0))))}
            />
          </div>

          <Separator />

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total cost</span>
            <span className={canAfford ? "font-semibold" : "font-semibold text-destructive"}>
              ${cost.toLocaleString()}
            </span>
          </div>

          {!canAfford && amount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4" />
              You don't have enough cash for this purchase.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!canAfford || busy} className="gap-2">
            {busy ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
            ) : (
              <><Gem className="h-4 w-4" /> Buy {amount} tokens</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
