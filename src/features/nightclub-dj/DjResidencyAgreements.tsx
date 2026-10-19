import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OwnedNightclub } from "@/hooks/useNightclubOwnership";
import { DjResidencyOccurrenceProgress } from "./DjResidencyOccurrenceProgress";

type Residency = {
  id: string;
  source_application_id: string;
  dj_display_name: string;
  setlist_name: string;
  planned_starts_at: string[];
  occurrence_count: number;
  proposed_fee: number;
  venue_timezone: string;
  status: "proposed" | "agreed" | "declined" | "ended" | "expired";
  expires_at: string;
};
type Shortlisted = { id: string; dj_display_name: string; setlist_name: string; starts_at: string };
type Action = "accept" | "decline" | "withdraw" | "end";
const isUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function useResidencyRequests() {
  const attempts = useRef(new Map<string, string>());
  const getId = (key: string) => {
    let id = attempts.current.get(key);
    if (!id) {
      try { const saved = sessionStorage.getItem(key); if (saved && isUuid.test(saved)) id = saved; }
      catch { /* Session storage is optional; retain in-memory retry identity. */ }
    }
    id ??= crypto.randomUUID();
    attempts.current.set(key, id);
    try { sessionStorage.setItem(key, id); } catch { /* Best effort. */ }
    return id;
  };
  const clearId = (key: string) => {
    attempts.current.delete(key);
    try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
  };
  return { getId, clearId };
}

function ResidencyRow({
  agreement, actions, onAction, busy, role, ownedClubId,
}: {
  agreement: Residency;
  actions: { value: Action; label: string }[];
  onAction: (action: Action, residencyId: string) => void;
  busy: boolean;
  role: "owner" | "dj";
  ownedClubId?: string;
}) {
  const expired = agreement.status === "proposed" && Date.parse(agreement.expires_at) <= Date.now();
  const status = expired ? "expired" : agreement.status;
  return <div className="rounded-md border p-3 space-y-2" data-testid="dj-residency-agreement">
    <div className="flex justify-between items-center gap-2">
      <div>
        <p className="font-medium text-sm">{agreement.dj_display_name} · {agreement.setlist_name}</p>
        <p className="text-xs text-muted-foreground">
          {agreement.occurrence_count} weekly proposals · {"$"}{agreement.proposed_fee} per set · {agreement.venue_timezone}
        </p>
      </div>
      <Badge variant="outline">{status === "agreed" ? "Agreed · not booked" : status}</Badge>
    </div>
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      {agreement.planned_starts_at.map((date, i) => <span key={date} className="border rounded px-2 py-1">
        Set {i + 1}: {new Intl.DateTimeFormat(undefined, { timeZone: agreement.venue_timezone,
          dateStyle: "medium", timeStyle: "short" }).format(new Date(date))}
      </span>)}
    </div>
    {status === "proposed" && <p className="text-xs text-muted-foreground">
      Offer closes {new Date(agreement.expires_at).toLocaleString()}
    </p>}
    <DjResidencyOccurrenceProgress plan={agreement} role={role} ownedClubId={ownedClubId} />
    {actions.length > 0 && <div className="flex flex-wrap gap-2">
      {actions.map(action => <Button key={action.value} size="sm" variant={action.value === "accept" ? "default" : "outline"}
        disabled={busy || expired} onClick={() => onAction(action.value, agreement.id)}>
        {action.label}
      </Button>)}
    </div>}
  </div>;
}

function useResidencyDecision(queryKey: readonly unknown[], idScope: string) {
  const client = useQueryClient();
  const { getId, clearId } = useResidencyRequests();
  const change = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: Action }) => {
      const key = `dj-residency-decision:${idScope}:${id}:${action}`;
      const requestId = getId(key);
      // Migration is not yet in generated Supabase TypeScript definitions.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("respond_nightclub_dj_residency", {
        p_residency_id: id, p_action: action, p_request_id: requestId,
      });
      if (error) throw error;
      if (!data || data.residency_id !== id ||
          !["agreed", "declined", "ended", "expired"].includes(data.status)) {
        throw new Error("Residency response not confirmed by the server");
      }
      clearId(key);
      return data.status as string;
    },
    onSuccess: (status) => {
      toast.success(status === "agreed" ? "Residency terms agreed — each show still needs separate funding and booking" :
        "Residency updated; already booked DJ shows are unchanged");
      void client.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Residency response failed"),
  });
  return change;
}

export function OwnedClubDjResidencies({ club }: { club: OwnedNightclub }) {
  const verified = Boolean(club.verified_purchase_id && club.club_id);
  const client = useQueryClient();
  const { getId, clearId } = useResidencyRequests();
  const [appId, setAppId] = useState("");
  const [weeks, setWeeks] = useState("2");
  const [fee, setFee] = useState("100");
  const queryKey = ["owner-dj-residencies", club.id] as const;
  const { data: residencies = [], isError } = useQuery<Residency[]>({
    queryKey, enabled: verified, refetchInterval: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("nightclub_dj_residencies")
        .select("id,source_application_id,dj_display_name,setlist_name,planned_starts_at,occurrence_count,proposed_fee,venue_timezone,status,expires_at")
        .eq("owned_club_id", club.id).order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      return (data ?? []) as Residency[];
    },
  });
  const { data: applicants = [], isError: applicantsError } = useQuery<Shortlisted[]>({
    queryKey: ["owned-club-dj-residency-applicants", club.id], enabled: verified,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_club_applications")
        .select("id,dj_display_name,setlist_name,starts_at").eq("owned_club_id", club.id)
        .eq("status", "shortlisted").gte("starts_at", new Date(Date.now() + 3 * 3600_000).toISOString())
        .order("starts_at").limit(40);
      if (error) throw error;
      return (data ?? []) as Shortlisted[];
    },
  });
  const proposed = useMutation({
    mutationFn: async () => {
      const count = Number(weeks), amount = Number(fee);
      if (!verified || !appId || !Number.isInteger(count) || count < 2 || count > 4 ||
        !Number.isInteger(amount) || amount < 50 ||
        amount > Math.min(1250, Math.max(250, 250 * club.quality_level))) {
        throw new Error("Choose an eligible DJ, 2–4 weeks and a fee within the club tier limit");
      }
      const key = `dj-residency-propose:${club.id}:${appId}:${count}:${amount}`;
      const requestId = getId(key);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("propose_nightclub_dj_residency", {
        p_owned_club_id: club.id, p_application_id: appId,
        p_occurrences: count, p_fee: amount, p_request_id: requestId,
      });
      if (error) throw error;
      if (typeof data !== "string" || !isUuid.test(data)) throw new Error("Residency offer not confirmed");
      clearId(key);
      return data;
    },
    onSuccess: () => {
      toast.success("Residency proposal sent — no fee charged or DJ shows booked");
      void client.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Could not propose residency"),
  });
  const decision = useResidencyDecision(queryKey, `owner:${club.profile_id}`);
  const available = applicants.filter(a =>
    !residencies.some(r => r.source_application_id === a.id));
  return <Card data-testid="owned-club-dj-residencies">
    <CardHeader><CardTitle className="text-lg flex gap-2 items-center">
      <CalendarRange className="h-5 w-5 text-primary" /> Resident DJs
    </CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Offer a shortlisted DJ 2–4 weekly sets at the club's local start time.
        Agreeing to a residency does not reserve the stage, put shows on Schedule or pay the DJ.
        Each set must be separately funded and booked through the approved DJ workflow.
      </p>
      {!verified ? <p className="text-sm text-muted-foreground">Receipt-verified ownership is required.</p> : <>
        {(isError || applicantsError) && <p role="alert" className="text-sm text-destructive">
          Could not load all residency details. Please refresh before making an offer.
        </p>}
        {!isError && !applicantsError && available.length > 0 && <div className="grid gap-2 sm:grid-cols-4 items-end">
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs">Shortlisted DJ / first proposed slot</p>
            <Select value={appId} onValueChange={setAppId}>
              <SelectTrigger><SelectValue placeholder="Choose applicant" /></SelectTrigger>
              <SelectContent>{available.map(a => <SelectItem key={a.id} value={a.id}>
                {a.dj_display_name} · {new Date(a.starts_at).toLocaleString()}
              </SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><label htmlFor="resident-weeks" className="text-xs">Weekly sets</label>
            <Select value={weeks} onValueChange={setWeeks}><SelectTrigger id="resident-weeks">
              <SelectValue /></SelectTrigger><SelectContent>
              {["2", "3", "4"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent></Select>
          </div>
          <div><label htmlFor="resident-fee" className="text-xs">Fee / set ($)</label>
            <Input id="resident-fee" type="number" min={50}
              max={Math.min(1250, Math.max(250, 250 * club.quality_level))}
              step={1} value={fee} onChange={e => setFee(e.target.value)} />
          </div>
          <Button disabled={!appId || proposed.isPending} onClick={() => proposed.mutate()}>
            {proposed.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Offer residency
          </Button>
        </div>}
        {residencies.map(r => <ResidencyRow key={r.id} agreement={r} role="owner" ownedClubId={club.id} busy={decision.isPending}
          actions={r.status === "proposed" ? [{ value: "withdraw", label: "Withdraw proposal" }] :
            r.status === "agreed" ? [{ value: "end", label: "End residency plan" }] : []}
          onAction={(action, id) => decision.mutate({ id, action })} />)}
        {!isError && residencies.length === 0 &&
          <p className="text-sm text-muted-foreground">No resident DJ proposals yet.</p>}
      </>}
    </CardContent>
  </Card>;
}

export function DjResidencyInvitations({ clubId, profileId }: { clubId: string; profileId: string }) {
  const queryKey = ["dj-residency-invitations", clubId, profileId] as const;
  const { data: residencies = [], isError } = useQuery<Residency[]>({
    queryKey, enabled: Boolean(clubId && profileId), refetchInterval: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("nightclub_dj_residencies")
        .select("id,source_application_id,dj_display_name,setlist_name,planned_starts_at,occurrence_count,proposed_fee,venue_timezone,status,expires_at")
        .eq("club_id", clubId).eq("dj_profile_id", profileId)
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as Residency[];
    },
  });
  const decision = useResidencyDecision(queryKey, `dj:${profileId}`);
  if (!residencies.length && !isError) return null;
  return <Card data-testid="dj-residency-invitations">
    <CardHeader><CardTitle className="flex items-center gap-2 text-lg">
      <CalendarRange className="h-5 w-5 text-primary" /> Your DJ residencies
    </CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-xs text-muted-foreground">
        A residency is an agreement in principle for recurring gigs, not a paid or confirmed booking.
        Each performance must still receive a separate funded offer and Schedule reservation.
        Ending a residency does not cancel already booked shows.
      </p>
      {isError && <p role="alert" className="text-sm text-destructive">Residency details unavailable.</p>}
      {residencies.map(r => <ResidencyRow key={r.id} agreement={r} role="dj" busy={decision.isPending}
        actions={r.status === "proposed" ? [
          { value: "accept", label: "Agree to terms" },
          { value: "decline", label: "Decline" },
        ] : r.status === "agreed" ? [{ value: "end", label: "End future proposals" }] : []}
        onAction={(action, id) => decision.mutate({ id, action })} />)}
    </CardContent>
  </Card>;
}
