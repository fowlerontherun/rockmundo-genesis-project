import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Music2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SavedSet = { id: string; name: string };
type DjApplication = { id: string; setlist_name: string; starts_at: string; status: string };
const uuid = /^[a-f0-9-]{36}$/i;

function initialLocalTime() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** An application is interest ONLY, and cannot reserve a slot or mint a payout. */
export function DjClubApplications({ clubId, profileId }: { clubId: string; profileId: string }) {
  const client = useQueryClient();
  const [setlistId, setSetlistId] = useState("");
  const [proposedLocal, setProposedLocal] = useState(initialLocalTime);
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  const { data: ownerId = null, isLoading: ownerLoading } = useQuery<string | null>({
    queryKey: ["dj-club-verified-applications", clubId],
    enabled: Boolean(clubId && profileId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_verified_nightclub_application_club", { p_club_id: clubId });
      if (error) throw error;
      return typeof data === "string" && uuid.test(data) ? data : null;
    },
  });
  const { data: sets = [] } = useQuery<SavedSet[]>({
    queryKey: ["dj-applicable-sets", profileId],
    enabled: Boolean(ownerId && profileId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_setlists")
        .select("id,name").eq("profile_id", profileId).limit(30);
      if (error) throw error;
      return (data ?? []) as SavedSet[];
    },
  });
  const { data: applications = [] } = useQuery<DjApplication[]>({
    queryKey: ["dj-club-my-applications", clubId, profileId],
    enabled: Boolean(ownerId && profileId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_club_applications")
        .select("id,setlist_name,starts_at,status").eq("profile_id", profileId)
        .eq("club_id", clubId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as DjApplication[];
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!ownerId || !setlistId) throw new Error("Choose a saved DJ set");
      const start = new Date(proposedLocal);
      if (!Number.isFinite(start.getTime())) throw new Error("Choose a valid local date and time");
      const fingerprint = JSON.stringify([profileId, ownerId, setlistId, start.toISOString()]);
      const key = `dj-application:${profileId}:${ownerId}`;
      let previous = pending.current;
      if (!previous) {
        try {
          const parsed = JSON.parse(sessionStorage.getItem(key) ?? "null") as { fingerprint?: string; id?: string } | null;
          if (parsed?.fingerprint && parsed.id && uuid.test(parsed.id)) {
            previous = { fingerprint: parsed.fingerprint, id: parsed.id };
          }
        } catch { /* Private sessions can block storage. */ }
      }
      const request = previous?.fingerprint === fingerprint ? previous : { fingerprint, id: crypto.randomUUID() };
      pending.current = request;
      try { sessionStorage.setItem(key, JSON.stringify(request)); } catch { /* In-memory retry remains. */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("apply_for_nightclub_dj_slot", {
        p_profile_id: profileId, p_owned_club_id: ownerId, p_setlist_id: setlistId,
        p_starts_at: start.toISOString(), p_request_id: request.id,
      });
      if (error) throw error;
      if (typeof data !== "string" || !uuid.test(data)) throw new Error("DJ application was not confirmed");
      pending.current = null;
      try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
      return data;
    },
    onSuccess: () => {
      toast.success("DJ application sent to the club owner — this is not a confirmed booking");
      void client.invalidateQueries({ queryKey: ["dj-club-my-applications", clubId, profileId] });
      void client.invalidateQueries({ queryKey: ["owned-club-dj-applications"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not apply"),
  });
  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("withdraw_nightclub_dj_application", { p_application_id: id });
      if (error) throw error;
      if (data !== id) throw new Error("Withdrawal was not confirmed");
    },
    onSuccess: () => {
      toast.success("DJ application withdrawn");
      void client.invalidateQueries({ queryKey: ["dj-club-my-applications", clubId, profileId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not withdraw"),
  });

  if (!ownerId) return ownerLoading ? null : null;
  return (
    <Card data-testid="dj-club-applications">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarClock className="h-5 w-5 text-primary" /> Apply to DJ at this club</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Send an interest application to the club owner. A shortlist is not a booked gig,
          stage reservation, paid contract or guaranteed place on your Schedule.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs mb-1">Saved DJ set</p>
            <Select value={setlistId} onValueChange={setSetlistId}>
              <SelectTrigger><SelectValue placeholder="Choose a saved set" /></SelectTrigger>
              <SelectContent>{sets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="dj-application-date" className="text-xs">Proposed start (your local time)</label>
            <Input id="dj-application-date" type="datetime-local"
              value={proposedLocal} onChange={e => setProposedLocal(e.target.value)} />
          </div>
        </div>
        <Button onClick={() => apply.mutate()} disabled={apply.isPending || !setlistId || !proposedLocal}>
          {apply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Music2 className="mr-2 h-4 w-4" />}
          Send DJ application
        </Button>
        {!sets.length && <p className="text-xs text-muted-foreground">Create a licensed, saved set in the DJ Mixing Studio before applying.</p>}
        {applications.length > 0 && <div className="space-y-2">
          <p className="text-sm font-medium">Your applications</p>
          {applications.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-2">
            <div><p className="text-sm">{a.setlist_name}</p><p className="text-xs text-muted-foreground">
              {new Date(a.starts_at).toLocaleString()} · {a.status === "shortlisted" ? "Shortlisted — not booked" : a.status}
            </p></div>
            {["pending","shortlisted"].includes(a.status) &&
              <Button size="sm" variant="outline" disabled={withdraw.isPending} onClick={() => withdraw.mutate(a.id)}>Withdraw</Button>}
          </div>)}
        </div>}
      </CardContent>
    </Card>
  );
}
