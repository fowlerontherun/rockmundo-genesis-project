import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { AlertTriangle, Coins, Gem, Loader2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BlindBox, RevealResult } from "@/pages/BlindBoxStore";

interface Props {
  box: BlindBox | null;
  balance: number;
  onClose: () => void;
  onPurchased: (r: RevealResult) => void;
}

export function BlindBoxPurchaseDialog({ box, balance, onClose, onPurchased }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!box) return null;
  const isPrem = box.currency === "premium";
  const price = isPrem ? box.price_premium : box.price_cash;
  const canAfford = balance >= price;
  const remaining = balance - price;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("open-blind-box", {
        body: { boxId: box.id },
      });
      if (error) throw error;
      if (data?.error) {
        toast({
          title: data.error === "INSUFFICIENT_FUNDS" ? "Insufficient funds" : "Could not open box",
          description: data.message ?? data.error,
          variant: "destructive",
        });
        return;
      }
      onPurchased(data as RevealResult);
    } catch (e) {
      toast({
        title: "Could not open box",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!box} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Confirm Purchase
          </DialogTitle>
          <DialogDescription>Mystery rewards will be revealed after opening.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{box.name}</h3>
              <Badge variant="outline" className="text-[10px]">{box.theme_genre}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{box.description}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Drop odds</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(box.tier_odds).map(([tier, pct]) => (
                <Badge key={tier} variant="outline" className="text-[10px]">
                  {tier} {pct}%
                </Badge>
              ))}
              <Badge variant="outline" className="text-[10px]">
                Pity: Epic+ at {box.pity_threshold}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-1 text-sm">
            <Row label="Current balance" value={fmt(balance, isPrem)} />
            <Row label="Box cost" value={`-${fmt(price, isPrem)}`} negative />
            <Separator className="my-1" />
            <Row label="Remaining" value={fmt(Math.max(0, remaining), isPrem)} bold danger={!canAfford} />
          </div>

          {!canAfford && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4" />
              You don't have enough {isPrem ? "premium tokens" : "cash"} for this box.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!canAfford || busy} className="gap-2">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening…</> : "Open Box"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fmt(v: number, premium: boolean) {
  return premium ? `${v} tokens` : `$${v.toLocaleString()}`;
}

function Row({ label, value, negative, bold, danger }: {
  label: string; value: string; negative?: boolean; bold?: boolean; danger?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={[
        bold ? "font-semibold" : "",
        negative ? "text-destructive" : "",
        danger ? "text-destructive" : "",
      ].join(" ")}>{value}</span>
    </div>
  );
}
