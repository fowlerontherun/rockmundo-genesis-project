import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Activity, AlertCircle, Banknote, HeartPulse, Search, ShieldAlert, UserRound, Users } from "lucide-react";
import { format } from "date-fns";

type PlayerSearchResult = {
  profile_id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  level: number | null;
  cash: number | null;
  fame: number | null;
  fans: number | null;
  current_city_name?: string | null;
  band_id?: string | null;
  band_name?: string | null;
  band_role?: string | null;
  created_at?: string | null;
};

type SupportSummary = {
  profile?: Record<string, any>;
  city?: Record<string, any> | null;
  band_memberships?: Array<Record<string, any>>;
  activity_status?: Record<string, any> | null;
  recent_songs?: Array<Record<string, any>>;
  recent_releases?: Array<Record<string, any>>;
  recent_activity_logs?: Array<Record<string, any>>;
  recent_audit_actions?: Array<Record<string, any>>;
};

const asArray = (value: unknown) => (Array.isArray(value) ? value : []);
const formatDate = (value?: string | null) => value ? format(new Date(value), "MMM d, yyyy HH:mm") : "—";

export default function PlayerManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [actionReason, setActionReason] = useState("");

  const search = useQuery({
    queryKey: ["admin-player-support-search", submittedQuery],
    enabled: submittedQuery.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_search_players", {
        p_query: submittedQuery.trim(),
        p_limit: 25,
      });
      if (error) throw error;
      return asArray(data) as PlayerSearchResult[];
    },
  });

  const summary = useQuery({
    queryKey: ["admin-player-support-summary", selectedProfileId],
    enabled: Boolean(selectedProfileId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_get_player_support_summary", {
        p_profile_id: selectedProfileId,
      });
      if (error) throw error;
      return (data ?? {}) as SupportSummary;
    },
  });

  const selectedResult = useMemo(
    () => search.data?.find((player) => player.profile_id === selectedProfileId) ?? null,
    [search.data, selectedProfileId],
  );

  const adjustCash = useMutation({
    mutationFn: async () => {
      if (!selectedProfileId) throw new Error("Select a player first");
      const amount = Number(cashAmount);
      if (!Number.isInteger(amount) || amount === 0) throw new Error("Enter a non-zero whole dollar amount");
      const { data, error } = await (supabase as any).rpc("admin_adjust_player_cash", {
        p_profile_id: selectedProfileId,
        p_amount: amount,
        p_reason: actionReason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Cash adjustment recorded", description: "The audited support action completed successfully." });
      setCashDialogOpen(false);
      setCashAmount("");
      setActionReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-player-support-summary", selectedProfileId] });
      queryClient.invalidateQueries({ queryKey: ["admin-player-support-search"] });
    },
    onError: (error: Error) => toast({ title: "Cash adjustment failed", description: error.message, variant: "destructive" }),
  });

  const cancelActivity = useMutation({
    mutationFn: async ({ statusId, reason }: { statusId: string; reason: string }) => {
      const { data, error } = await (supabase as any).rpc("admin_cancel_profile_activity", {
        p_status_id: statusId,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Activity cancelled", description: "The stuck activity was removed and audited." });
      queryClient.invalidateQueries({ queryKey: ["admin-player-support-summary", selectedProfileId] });
    },
    onError: (error: Error) => toast({ title: "Cancel activity failed", description: error.message, variant: "destructive" }),
  });

  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(searchQuery.trim());
    setSelectedProfileId(null);
  };

  const playerName = selectedResult?.display_name || summary.data?.profile?.display_name || "Selected player";
  const profile = summary.data?.profile;
  const currentActivity = summary.data?.activity_status;

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="h-8 w-8" /> Player Support</h1>
          <p className="text-muted-foreground">Search players, inspect read-only support state, and run audited beta corrections.</p>
        </div>

        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Server-authoritative support tools</AlertTitle>
          <AlertDescription>Searches and corrections are performed through admin-only RPCs. Sensitive values such as auth secrets and raw credentials are not shown.</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Player lookup</CardTitle>
            <CardDescription>Search by display name, username, profile ID, user ID, or band name. Email search is intentionally omitted unless a secure admin API provides it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={runSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search player, ID, character, or band..." />
              </div>
              <Button type="submit" disabled={searchQuery.trim().length < 2 || search.isFetching}>Search</Button>
            </form>
            {search.isError && <p className="mt-3 text-sm text-destructive">{(search.error as Error).message}</p>}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>{search.isFetching ? "Loading..." : `${search.data?.length ?? 0} players found`}</CardDescription>
            </CardHeader>
            <CardContent>
              {!submittedQuery ? <p className="text-sm text-muted-foreground">Enter a search above to begin.</p> : null}
              {submittedQuery && !search.isFetching && search.data?.length === 0 ? <p className="text-sm text-muted-foreground">No matching players found.</p> : null}
              {search.data?.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>State</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {search.data.map((player) => (
                      <TableRow key={player.profile_id} className={player.profile_id === selectedProfileId ? "bg-muted/60" : undefined}>
                        <TableCell>
                          <div className="font-medium">{player.display_name || player.username || "Unnamed"}</div>
                          <div className="text-xs text-muted-foreground">{player.user_id}</div>
                          <div className="text-xs text-muted-foreground">Band: {player.band_name || "None"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Lvl {player.level ?? 1}</Badge>
                          <div className="mt-1 text-xs text-muted-foreground">${(player.cash ?? 0).toLocaleString()} · {player.current_city_name || "Unknown city"}</div>
                        </TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSelectedProfileId(player.profile_id)}>Inspect</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> Support summary</CardTitle>
              <CardDescription>{selectedProfileId ? `Read-only snapshot for ${playerName}` : "Select a player to view details."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {summary.isFetching ? <p className="text-sm text-muted-foreground">Loading player support data...</p> : null}
              {summary.isError ? <p className="text-sm text-destructive">{(summary.error as Error).message}</p> : null}
              {profile ? (
                <>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Metric icon={Banknote} label="Cash" value={`$${(profile.cash ?? 0).toLocaleString()}`} />
                    <Metric icon={Activity} label="Progress" value={`Lvl ${profile.level ?? 1} · XP ${profile.experience ?? 0}`} />
                    <Metric icon={Users} label="Audience" value={`${profile.fame ?? 0} fame · ${profile.fans ?? 0} fans`} />
                    <Metric icon={HeartPulse} label="Vitals" value={`${profile.health ?? "—"} HP · ${profile.energy ?? "—"} energy`} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setCashDialogOpen(true)}>Audited cash adjustment</Button>
                    {currentActivity?.id ? (
                      <Button variant="destructive" disabled={cancelActivity.isPending} onClick={() => {
                        const reason = window.prompt("Reason for cancelling this activity (required, min 8 chars):");
                        if (reason) cancelActivity.mutate({ statusId: currentActivity.id, reason });
                      }}>Cancel current activity</Button>
                    ) : null}
                  </div>

                  <Separator />
                  <Section title="Profile and location">
                    <InfoGrid rows={[
                      ["Profile ID", profile.id], ["User ID", profile.user_id], ["Display name", profile.display_name || "—"], ["City", summary.data?.city?.name || profile.current_city_id || "—"], ["Joined", formatDate(profile.created_at)], ["Updated", formatDate(profile.updated_at)],
                    ]} />
                  </Section>
                  <Section title="Band membership"><SimpleList rows={summary.data?.band_memberships} empty="No band memberships." render={(band) => `${band.band_name} · ${band.role || "member"} · ${band.genre || "unknown genre"}`} /></Section>
                  <Section title="Current and upcoming activity">{currentActivity ? <pre className="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(currentActivity, null, 2)}</pre> : <p className="text-sm text-muted-foreground">No current activity status found.</p>}</Section>
                  <Section title="Recent songs"><SimpleList rows={summary.data?.recent_songs} empty="No recent songs." render={(song) => `${song.title} · ${song.status || "unknown"} · streams ${song.streams ?? 0} · ${formatDate(song.created_at)}`} /></Section>
                  <Section title="Recent releases"><SimpleList rows={summary.data?.recent_releases} empty="No recent releases." render={(release) => `${release.title} · ${release.release_status || "unknown"} · ${formatDate(release.created_at)}`} /></Section>
                  <Section title="Recent transactions, errors, and events"><SimpleList rows={summary.data?.recent_activity_logs} empty="No recent activity logs." render={(log) => `${formatDate(log.created_at)} · ${log.activity_category}/${log.activity_type}: ${log.description}`} /></Section>
                  <Section title="Moderation / support audit"><SimpleList rows={summary.data?.recent_audit_actions} empty="No recent admin audit actions for this player." render={(audit) => `${formatDate(audit.created_at)} · ${audit.action} · ${audit.metadata?.reason || "no reason recorded"}`} /></Section>
                </>
              ) : !summary.isFetching ? <p className="text-sm text-muted-foreground">No player selected.</p> : null}
            </CardContent>
          </Card>
        </div>

        <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Audited cash adjustment</DialogTitle>
              <DialogDescription>Use only for beta support corrections. A reason and before/after values are recorded in the admin audit log.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Amount</Label><Input type="number" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} placeholder="e.g. 500 or -250" /></div>
              <div className="space-y-2"><Label>Reason</Label><Textarea value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="Describe the support ticket or beta issue being corrected..." /></div>
              <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Confirm the selected player and reason before applying. This action changes economy state.</AlertDescription></Alert>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setCashDialogOpen(false)}>Cancel</Button><Button onClick={() => adjustCash.mutate()} disabled={adjustCash.isPending}>Confirm adjustment</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="rounded-lg border p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div className="space-y-2"><h3 className="font-semibold">{title}</h3>{children}</div>; }
function InfoGrid({ rows }: { rows: Array<[string, any]> }) { return <div className="grid gap-2 md:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded border p-2"><div className="text-xs text-muted-foreground">{label}</div><div className="break-all text-sm">{value}</div></div>)}</div>; }
function SimpleList({ rows, empty, render }: { rows?: Array<Record<string, any>>; empty: string; render: (row: Record<string, any>) => string }) { const list = rows ?? []; return list.length ? <div className="space-y-2">{list.map((row, index) => <div key={row.id ?? index} className="rounded border p-2 text-sm">{render(row)}</div>)}</div> : <p className="text-sm text-muted-foreground">{empty}</p>; }
