import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Palmtree } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveProfile } from "@/hooks/useActiveProfile";

type BreakType = {
  type: string; label: string; description: string; min_days: number; max_days: number; min_fame: number;
  base_cost: number; daily_cost: number; daily_effects: Record<string, number>; notice_days: number; cooldown_days: number; refund_until_days: number; always_band_approval: boolean;
};
type Booking = { id: string; profile_id: string; type: string; status: string; start_date: string; end_date: string; cost: number; refunded: number; conflict_gigs: number; days_processed: number };

const db = supabase as any;
const nice = (s: string) => s.replace(/_/g, " ");
const addDays = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const dayCount = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;

export default function TimeAwayBookingPanel() {
  const { profileId } = useActiveProfile() as { profileId?: string | null };
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("rest_day");
  const [start, setStart] = useState(addDays(1));
  const [end, setEnd] = useState(addDays(1));
  const [busy, setBusy] = useState(false);

  const types = useQuery({
    queryKey: ["time-away-types"],
    queryFn: async () => {
      const { data, error } = await db.from("time_away_type_config").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as BreakType[];
    },
  });
  const bookings = useQuery({
    queryKey: ["time-away-bookings", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await db.from("time_away_bookings").select("*").order("start_date", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });

  const t = types.data?.find((x) => x.type === selected);
  const days = dayCount(start, end);
  const cost = t ? t.base_cost + t.daily_cost * Math.max(days, 0) : 0;
  const refresh = () => qc.invalidateQueries({ queryKey: ["time-away-bookings"] });

  const pick = (bt: BreakType) => {
    setSelected(bt.type);
    const s = addDays(Math.max(1, bt.notice_days));
    setStart(s);
    const e = new Date(s); e.setDate(e.getDate() + bt.min_days - 1);
    setEnd(e.toISOString().slice(0, 10));
  };

  const book = async () => {
    if (!profileId || !t) return;
    setBusy(true);
    const { data, error } = await db.rpc("book_time_away", { p_profile_id: profileId, p_type: t.type, p_start: start, p_end: end });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(data?.status === "pending_approval"
      ? `Request sent to your band leader (${data.conflict_gigs} gig${data.conflict_gigs === 1 ? "" : "s"} on those dates).`
      : `${t.label} booked for $${data?.cost}.`);
    refresh();
  };
  const cancel = async (b: Booking) => {
    if (!profileId || !confirm("Cancel this break?")) return;
    const { data, error } = await db.rpc("cancel_time_away", { p_profile_id: profileId, p_booking_id: b.id });
    if (error) return toast.error(error.message);
    toast.success(`Cancelled. Refund: $${data?.refund ?? 0}`);
    refresh();
  };
  const decide = async (b: Booking, approve: boolean) => {
    const { error } = await db.rpc("decide_time_away", { p_booking_id: b.id, p_approve: approve });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Break approved" : "Break declined and refunded");
    refresh();
  };

  const mine = (bookings.data ?? []).filter((b) => b.profile_id === profileId);
  const toDecide = (bookings.data ?? []).filter((b) => b.profile_id !== profileId && b.status === "pending_approval");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Palmtree className="h-4 w-4 text-primary" /> Time away</CardTitle>
        <p className="text-xs text-muted-foreground">Book a break. You recover a little each day you're away. If your band has gigs on those dates, the band leader must approve.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {(types.data ?? []).map((bt) => (
            <button key={bt.type} onClick={() => pick(bt)}
              className={`shrink-0 rounded-md border px-2 py-1.5 text-left text-[11px] ${selected === bt.type ? "border-primary bg-primary/10" : "border-border"}`}>
              <div className="font-semibold">{bt.label}</div>
              <div className="text-muted-foreground">{bt.min_days === bt.max_days ? `${bt.min_days} day` : `${bt.min_days}–${bt.max_days} days`}{bt.min_fame ? ` · ${bt.min_fame} fame` : ""}</div>
            </button>
          ))}
        </div>
        {t && (
          <div className="rounded-md border p-2 text-[11px] space-y-2">
            <p className="text-muted-foreground">{t.description}</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(t.daily_effects).map(([k, v]) => <Badge key={k} variant="outline" className="text-[10px]">{nice(k)} {v > 0 ? "+" : ""}{v}/day</Badge>)}
            </div>
            <p className="text-muted-foreground">Notice: {t.notice_days} days · wait {t.cooldown_days} days between · full refund if cancelled {t.refund_until_days}+ days before (otherwise half){t.always_band_approval ? " · always needs band leader approval" : ""}</p>
            <div className="flex flex-nowrap items-center gap-2">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 text-xs" />
              <span>to</span>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="flex items-center justify-between">
              <span>{days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "Check dates"} · <b>${cost.toLocaleString()}</b></span>
              <Button size="sm" disabled={busy || !profileId || days < 1} onClick={book}>Book</Button>
            </div>
          </div>
        )}
        {toDecide.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold">Band members asking for time off</p>
            {toDecide.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-md border p-2 text-[11px]">
                <span>{nice(b.type)} · {b.start_date} → {b.end_date} · {b.conflict_gigs} gig(s)</span>
                <span className="flex gap-1"><Button size="sm" variant="outline" onClick={() => decide(b, false)}>Decline</Button><Button size="sm" onClick={() => decide(b, true)}>Approve</Button></span>
              </div>
            ))}
          </div>
        )}
        {mine.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold">Your breaks</p>
            {mine.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-md border p-2 text-[11px]">
                <span className="capitalize">{nice(b.type)} · {b.start_date} → {b.end_date} · ${b.cost}{b.refunded ? ` (refunded $${b.refunded})` : ""}{b.days_processed ? ` · ${b.days_processed} day(s) recovered` : ""}</span>
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] capitalize">{b.status === "pending_approval" ? "awaiting band" : nice(b.status)}</Badge>
                  {["pending_approval", "booked", "active"].includes(b.status) && <Button size="sm" variant="ghost" onClick={() => cancel(b)}>{b.status === "active" ? "End" : "Cancel"}</Button>}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
