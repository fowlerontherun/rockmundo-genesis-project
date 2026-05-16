import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Handshake, X, Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  baseCents: number;
  perEpisode?: boolean;
  episodeCount?: number;
  title: string;
}

export function NegotiateOfferDialog({
  open, onOpenChange, offerId, baseCents, perEpisode, episodeCount = 1, title,
}: Props) {
  const qc = useQueryClient();
  const [counter, setCounter] = useState<string>(String(Math.round(baseCents / 100)));

  const { data: neg } = useQuery({
    queryKey: ["acting-negotiation", offerId],
    queryFn: async () => {
      const { data } = await supabase.from("acting_negotiations")
        .select("*").eq("offer_id", offerId).maybeSingle();
      return data;
    },
    enabled: open && !!offerId,
  });

  const currentStudioCents = Number(neg?.studio_offer_cents ?? baseCents);
  const round = neg?.round ?? 1;
  const roundsLeft = Math.max(0, 3 - round);

  const mut = useMutation({
    mutationFn: async (vars: { action: "accept" | "counter" | "reject"; counterCents?: number }) => {
      const { data, error } = await supabase.functions.invoke("negotiate-acting-offer", {
        body: { offerId, ...vars },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["acting-negotiation", offerId] });
      qc.invalidateQueries({ queryKey: ["acting-offers"] });
      qc.invalidateQueries({ queryKey: ["acting-contracts"] });
      qc.invalidateQueries({ queryKey: ["film-offers"] });
      qc.invalidateQueries({ queryKey: ["film-contracts"] });
      if (data?.result === "accepted") {
        toast.success("Deal accepted!", {
          description: `Final pay: $${(data.final_cents / 100).toLocaleString()}${perEpisode ? "/ep" : ""}`,
        });
        onOpenChange(false);
      } else if (data?.result === "counter") {
        toast.info("Studio counters", {
          description: `New offer: $${(data.new_studio_offer_cents / 100).toLocaleString()}${perEpisode ? "/ep" : ""}`,
        });
      } else if (data?.result === "studio_walked") {
        toast.error("Studio walked away", { description: data.reason });
        onOpenChange(false);
      } else if (data?.result === "rejected") {
        toast.message("Offer rejected");
        onOpenChange(false);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counterCents = Math.round(Number(counter || 0) * 100);
  const ratio = counterCents / currentStudioCents;
  const probHint = counterCents <= currentStudioCents
    ? "Very likely"
    : ratio <= 1.2 ? "Likely"
    : ratio <= 1.5 ? "Risky"
    : ratio <= 2 ? "Unlikely"
    : "Studio will walk";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" /> Negotiate — {title}
          </DialogTitle>
          <DialogDescription>
            Round {round} / 3 · {roundsLeft} counter{roundsLeft === 1 ? "" : "s"} remaining
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current studio offer</span>
              <span className="font-semibold">
                ${(currentStudioCents / 100).toLocaleString()}{perEpisode ? " / ep" : ""}
              </span>
            </div>
            {perEpisode && (
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Over {episodeCount} eps</span>
                <span>${((currentStudioCents * episodeCount) / 100).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Your counter-offer (USD{perEpisode ? " per episode" : ""})</Label>
            <Input
              type="number" min={0} value={counter}
              onChange={(e) => setCounter(e.target.value)}
            />
            <div className="flex items-center justify-between text-xs">
              <Badge variant="outline">{probHint}</Badge>
              <span className="text-muted-foreground">
                {ratio > 1 ? `+${Math.round((ratio - 1) * 100)}% vs offer` : "At or below offer"}
              </span>
            </div>
          </div>

          {round >= 3 && (
            <Alert variant="destructive">
              <AlertDescription>Final round — countering again may end negotiations.</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => mut.mutate({ action: "reject" })} disabled={mut.isPending}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
          <Button variant="secondary" onClick={() => mut.mutate({ action: "counter", counterCents })} disabled={mut.isPending}>
            <Handshake className="h-4 w-4 mr-1" /> Counter
          </Button>
          <Button onClick={() => mut.mutate({ action: "accept" })} disabled={mut.isPending}>
            <Check className="h-4 w-4 mr-1" /> Accept ${(currentStudioCents / 100).toLocaleString()}{perEpisode ? "/ep" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
