import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OwnedNightclub } from "@/hooks/useNightclubOwnership";

type Application = {
  id: string;
  dj_display_name: string;
  setlist_name: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "shortlisted" | "declined" | "withdrawn";
};
const validUuid = /^[a-f0-9-]{36}$/i;

export function OwnedClubDjApplications({ club }: { club: OwnedNightclub }) {
  const verified = Boolean(club.verified_purchase_id && club.club_id);
  const client = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const { data: applications = [], isLoading, isError } = useQuery<Application[]>({
    queryKey: ["owned-club-dj-applications", club.id],
    enabled: verified,
    refetchInterval: 60_000,
    queryFn: async () => {
      // Live migration has not yet been added to the generated API types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_club_applications")
        .select("id,dj_display_name,setlist_name,starts_at,ends_at,status")
        .eq("owned_club_id", club.id).order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });
  const review = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "shortlist" | "decline" }) => {
      if (!verified) throw new Error("Verified ownership required");
      const key = `dj-club-review:${club.profile_id}:${club.id}:${id}:${action}`;
      let requestId = keys.current.get(key);
      if (!requestId) {
        try {
          const saved = sessionStorage.getItem(key);
          if (saved && validUuid.test(saved)) requestId = saved;
        } catch { /* Private sessions may disable storage. */ }
      }
      requestId ??= crypto.randomUUID();
      keys.current.set(key, requestId);
      try { sessionStorage.setItem(key, requestId); } catch { /* In-memory retry remains. */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("review_nightclub_dj_application", {
        p_owned_club_id: club.id, p_application_id: id, p_decision: action, p_request_id: requestId,
      });
      if (error) throw error;
      if (data !== id) throw new Error("Owner review was not confirmed");
      keys.current.delete(key);
      try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
    },
    onSuccess: (_, { action }) => {
      toast.success(action === "shortlist" ? "DJ shortlisted — no booking or fee has been created" : "DJ application declined");
      void client.invalidateQueries({ queryKey: ["owned-club-dj-applications", club.id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not review application"),
  });
  return (
    <Card data-testid="owned-club-dj-applications">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-primary" /> DJ applications
          {verified && <Badge variant="outline">{applications.filter(a => a.status === "pending").length} pending</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!verified ? <p className="text-sm text-muted-foreground">
          DJ application reviews require a receipt-verified nightclub purchase.
        </p> : <>
          <p className="text-xs text-muted-foreground">
            Shortlist promising DJs or decline an application. A shortlist is only an expression
            of interest: it does not reserve the stage, schedule a gig, promise pay or create a contract.
          </p>
          {isLoading && <p className="text-sm text-muted-foreground">Loading applications…</p>}
          {isError && <p className="text-sm text-destructive" role="alert">Could not load DJ applications.</p>}
          {!isLoading && !isError && applications.length === 0 &&
            <p className="text-sm text-muted-foreground">No DJ applications yet.</p>}
          {applications.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{a.dj_display_name}</p>
              <p className="text-xs text-muted-foreground">{a.setlist_name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.starts_at).toLocaleString()} – {new Date(a.ends_at).toLocaleTimeString()}
              </p>
              <Badge variant="outline">{a.status === "shortlisted" ? "Shortlisted · not booked" : a.status}</Badge>
            </div>
            {a.status === "pending" && <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: a.id, action: "shortlist" })}>
                {review.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null} Shortlist
              </Button>
              <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: a.id, action: "decline" })}>Decline</Button>
            </div>}
          </div>)}
        </>}
      </CardContent>
    </Card>
  );
}
