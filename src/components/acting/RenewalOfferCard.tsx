import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tv, Repeat, X, Check, Handshake } from "lucide-react";

export function RenewalOfferCard({ renewal }: { renewal: any }) {
  const qc = useQueryClient();
  const seriesTitle = renewal.scripted_series?.title ?? "TV Series";
  const offerCents = Number(renewal.offered_pay_per_episode_cents ?? 0);
  const eps = renewal.episode_count ?? 10;
  const [counter, setCounter] = useState<string>(String(Math.round(offerCents / 100)));
  const [showCounter, setShowCounter] = useState(false);

  const mut = useMutation({
    mutationFn: async (vars: { action: "accept" | "reject" | "counter"; counterCents?: number }) => {
      const { data, error } = await supabase.functions.invoke("respond-series-renewal", {
        body: { renewalId: renewal.id, ...vars },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["acting-renewals"] });
      qc.invalidateQueries({ queryKey: ["acting-contracts-series"] });
      if (data?.result === "accepted") {
        toast.success(`Returning for season ${renewal.new_season_number}!`, {
          description: `$${(data.final_cents / 100).toLocaleString()}/ep × ${eps} eps`,
        });
      } else if (data?.result === "rejected") {
        toast.message("Renewal declined");
      } else if (data?.result === "studio_walked") {
        toast.error("Studio walked away from the counter");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-primary/40 bg-gradient-to-r from-primary/10 to-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <Tv className="h-5 w-5" /> {seriesTitle}
            <Badge><Repeat className="h-3 w-3 mr-1" /> Season {renewal.new_season_number}</Badge>
          </CardTitle>
          <div className="text-right">
            <div className="text-2xl font-bold">${(offerCents / 100).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              per ep · ${((offerCents * eps) / 100).toLocaleString()} total
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showCounter && (
          <div className="space-y-2">
            <Label>Counter offer ($/episode)</Label>
            <Input type="number" value={counter} onChange={(e) => setCounter(e.target.value)} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => mut.mutate({ action: "reject" })} disabled={mut.isPending}>
            <X className="h-4 w-4 mr-1" /> Decline
          </Button>
          {!showCounter ? (
            <Button variant="secondary" size="sm" onClick={() => setShowCounter(true)}>
              <Handshake className="h-4 w-4 mr-1" /> Counter
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => mut.mutate({ action: "counter", counterCents: Math.round(Number(counter) * 100) })} disabled={mut.isPending}>
              Send counter
            </Button>
          )}
          <Button size="sm" onClick={() => mut.mutate({ action: "accept" })} disabled={mut.isPending}>
            <Check className="h-4 w-4 mr-1" /> Accept
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
