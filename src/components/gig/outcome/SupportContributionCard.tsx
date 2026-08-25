import { useEffect, useState } from "react";
import { Banknote, Handshake, Loader2, Star, Ticket, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type SupportContribution = {
  gigId?: string;
  supportSlotId?: string;
  supportBandId?: string;
  supportBandName?: string;
  headlinerBandId?: string;
  headlinerBandName?: string;
  attendance?: number;
  performanceRating?: number;
  ticketRevenue?: number;
  supportPayment?: number;
  ticketDemandMultiplier?: number;
  ticketDemandBoostPercent?: number;
  supportFameGain?: number;
  supportFanGain?: number;
  relationshipGain?: number;
  reputationGain?: number;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);

export function SupportContributionCard({ gigId }: { gigId?: string | null }) {
  const [data, setData] = useState<SupportContribution | null>(null);
  const [loading, setLoading] = useState(Boolean(gigId));

  useEffect(() => {
    let mounted = true;
    if (!gigId) {
      setData(null);
      setLoading(false);
      return () => { mounted = false; };
    }

    setLoading(true);
    void (async () => {
      const { data: contribution, error } = await (supabase as any).rpc("get_support_gig_contribution", {
        p_gig_id: gigId,
      });
      if (!mounted) return;
      if (error) {
        if (import.meta.env.DEV) console.warn("Unable to load support contribution", { gigId, error });
        setData(null);
      } else {
        setData(contribution && typeof contribution === "object" ? contribution as SupportContribution : null);
      }
      setLoading(false);
    })();

    return () => { mounted = false; };
  }, [gigId]);

  if (!gigId) return null;
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading support contribution…
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const demandBoost = Number(data.ticketDemandBoostPercent ?? Math.max(0, ((Number(data.ticketDemandMultiplier) || 1) - 1) * 100));

  return (
    <Card className="border-primary/20" id="support-contribution">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5" /> Support act contribution
            </CardTitle>
            <CardDescription>
              Settled contribution from {data.supportBandName || "the support band"}; these are authoritative post-show values, not projections.
            </CardDescription>
          </div>
          <Badge variant="outline">20% artist ticket share</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Banknote />} label="Support payment" value={money(Number(data.supportPayment) || 0)} detail={`From ${money(Number(data.ticketRevenue) || 0)} ticket revenue`} />
          <Metric icon={<Ticket />} label="Ticket demand" value={`+${demandBoost.toFixed(1)}%`} detail="Support-driven demand uplift" />
          <Metric icon={<Star />} label="Support rating" value={`${Number(data.performanceRating || 0).toFixed(1)}/25`} detail={`${Number(data.attendance || 0).toLocaleString()} attended`} />
          <Metric icon={<Users />} label="New fans" value={`+${Number(data.supportFanGain || 0).toLocaleString()}`} detail={`+${Number(data.supportFameGain || 0).toLocaleString()} fame`} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Metric icon={<Handshake />} label="Band relationship" value={`+${Number(data.relationshipGain || 0)}`} detail="Relationship gained from this show" />
          <Metric icon={<TrendingUp />} label="Support reputation" value={`+${Number(data.reputationGain || 0)}`} detail="Support career reputation gained" />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
