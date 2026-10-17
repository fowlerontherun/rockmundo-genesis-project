import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radio, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { GigAudiencePolls } from "@/components/gig/GigAudiencePolls";

type LiveGig = { id: string; status: string; scheduled_date: string; band: { id: string; name: string } | null; venue: { name: string } | null };
const db = supabase as any;

export default function LiveGigs() {
  const { profileId } = useActiveProfile() as { profileId?: string | null };
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const gigs = useQuery({
    queryKey: ["live-gigs-now"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db.from("gigs")
        .select("id,status,scheduled_date,band:bands!gigs_band_id_fkey(id,name),venue:venues!gigs_venue_id_fkey(name)")
        .eq("status", "in_progress").order("scheduled_date", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as LiveGig[];
    },
  });
  const mine = useQuery({
    queryKey: ["live-gigs-mine", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [att, bands] = await Promise.all([
        db.from("gig_audience_attendance").select("gig_id").eq("profile_id", profileId),
        db.from("band_members").select("band_id").eq("profile_id", profileId),
      ]);
      return { checkedIn: new Set<string>((att.data ?? []).map((r: any) => r.gig_id)), bands: new Set<string>((bands.data ?? []).map((r: any) => r.band_id)) };
    },
  });

  const checkIn = async (gig: LiveGig) => {
    const { error } = await db.rpc("check_in_gig_audience", { p_gig_id: gig.id, p_ticket_id: null, p_attendance_type: "in_person" });
    if (error) return toast.error(error.message);
    toast.success(`You're in the crowd for ${gig.band?.name ?? "the gig"}`);
    setSelected(gig.id);
    await qc.invalidateQueries({ queryKey: ["live-gigs-mine", profileId] });
  };

  const current = (gigs.data ?? []).find((g) => g.id === selected);
  const isBand = !!current?.band && !!mine.data?.bands.has(current.band.id);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Radio className="h-5 w-5 text-primary" /> Live gigs</h1>
        <p className="text-xs text-muted-foreground">Join the crowd at a show happening now and vote in crowd polls to shape the night.</p>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">On stage now</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs">
          {gigs.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!gigs.isLoading && (gigs.data ?? []).length === 0 && <p className="text-muted-foreground">No gigs are live right now. Check back later.</p>}
          {(gigs.data ?? []).map((g) => {
            const inCrowd = mine.data?.checkedIn.has(g.id);
            const ownBand = !!g.band && !!mine.data?.bands.has(g.band.id);
            return (
              <div key={g.id} className={`flex flex-wrap items-center gap-2 rounded border px-2 py-1.5 ${selected === g.id ? "border-primary" : ""}`}>
                <span className="font-medium">{g.band?.name ?? "Unknown band"}</span>
                <span className="text-muted-foreground">@ {g.venue?.name ?? "venue"}</span>
                {ownBand && <Badge variant="secondary" className="text-[10px]">Your band</Badge>}
                <span className="ml-auto flex gap-1">
                  {inCrowd || ownBand ? (
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setSelected(g.id)}>Polls</Button>
                  ) : (
                    <Button size="sm" className="h-7 text-[11px]" disabled={!profileId} onClick={() => void checkIn(g)}><Ticket className="mr-1 h-3.5 w-3.5" />Join crowd</Button>
                  )}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
      {current && <GigAudiencePolls gigId={current.id} gigStatus={current.status} canVote={!isBand} />}
    </div>
  );
}
