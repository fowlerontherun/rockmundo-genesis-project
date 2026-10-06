import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Clock, Heart, HeartPulse, History, Loader2, RefreshCw, Skull } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ComaEventRow {
  id: string;
  profile_id: string;
  event_type: "entered" | "revived";
  cause: string | null;
  source: string;
  coma_started_at: string | null;
  account_last_activity_at: string | null;
  created_at: string;
}

interface ComaEventDisplay extends ComaEventRow {
  characterName: string;
  username: string | null;
}

interface ComaSystemHealth {
  healthy: boolean;
  current_inactivity_comas: number;
  inactivity_snapshot_conflicts: number;
  missing_activity_snapshots: number;
  recent_returners_in_coma: number;
  entries_last_7_days: number;
  revivals_last_7_days: number;
  cron: {
    active: boolean;
    schedule: string | null;
    last_status: string | null;
    last_started_at: string | null;
    last_completed_at: string | null;
    last_message: string | null;
  };
}

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

interface RpcClient {
  rpc: (name: string) => Promise<RpcResult>;
}

const rpcClient = supabase as unknown as RpcClient;

const formatDateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const sourceLabel = (source: string) => {
  switch (source) {
    case "scheduled_inactivity_check":
      return "Scheduled inactivity check";
    case "player_revival":
      return "Player revival";
    case "admin_recovery":
      return "Admin recovery";
    case "inactivity_backfill":
      return "Historical inactivity backfill";
    case "legacy_backfill":
      return "Legacy health backfill";
    default:
      return source.replace(/_/g, " ");
  }
};

const DeathSystemAdmin = () => {
  const navigate = useNavigate();

  const {
    data: stats,
    isLoading,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["death-stats"],
    queryFn: async () => {
      const [livingResult, comatoseResult, inactivityResult, legacyNeglectResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .is("died_at", null),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .not("died_at", "is", null),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .not("died_at", "is", null)
          .ilike("death_cause", "%inactivity%"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .not("died_at", "is", null)
          .eq("death_cause", "neglect"),
      ]);

      const error =
        livingResult.error ??
        comatoseResult.error ??
        inactivityResult.error ??
        legacyNeglectResult.error;
      if (error) throw error;

      return {
        living: livingResult.count ?? 0,
        comatose: comatoseResult.count ?? 0,
        inactivity: inactivityResult.count ?? 0,
        legacyNeglect: legacyNeglectResult.count ?? 0,
      };
    },
  });

  const {
    data: comaHealth,
    isLoading: healthLoading,
    isFetching: healthFetching,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["coma-system-health"],
    queryFn: async (): Promise<ComaSystemHealth> => {
      const { data, error } = await rpcClient.rpc("admin_get_coma_system_health");
      if (error) throw new Error(error.message || "Unable to load coma system health");
      return data as ComaSystemHealth;
    },
    refetchInterval: 60_000,
  });

  const {
    data: recentEvents,
    isLoading: eventsLoading,
    isFetching: eventsFetching,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ["coma-events", "recent"],
    queryFn: async (): Promise<ComaEventDisplay[]> => {
      const { data: eventData, error: eventError } = await supabase
        .from("character_coma_events" as never)
        .select("id, profile_id, event_type, cause, source, coma_started_at, account_last_activity_at, created_at")
        .order("created_at", { ascending: false })
        .limit(30);

      if (eventError) throw eventError;

      const events = (eventData ?? []) as unknown as ComaEventRow[];
      const profileIds = [...new Set(events.map((event) => event.profile_id))];

      if (profileIds.length === 0) return [];

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", profileIds);

      if (profileError) throw profileError;

      const profileNames = new Map(
        (profileData ?? []).map((profile) => [
          profile.id,
          {
            characterName: profile.display_name || profile.username || "Unknown character",
            username: profile.username ?? null,
          },
        ]),
      );

      return events.map((event) => ({
        ...event,
        characterName: profileNames.get(event.profile_id)?.characterName ?? "Unknown character",
        username: profileNames.get(event.profile_id)?.username ?? null,
      }));
    },
    refetchInterval: 60_000,
  });

  const statValue = (value?: number) =>
    isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <span>{value ?? 0}</span>;

  const refreshAll = () => {
    void refetchStats();
    void refetchHealth();
    void refetchEvents();
  };

  const refreshing = statsFetching || healthFetching || eventsFetching;

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Character Coma & Recovery</h1>
              <p className="text-sm text-muted-foreground">
                Monitor the live inactivity-coma policy, recent transitions and character recovery state.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Heart className="h-4 w-4 text-emerald-500" /> Living characters
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{statValue(stats?.living)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Skull className="h-4 w-4 text-destructive" /> Comatose characters
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{statValue(stats?.comatose)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-amber-500" /> Inactivity comas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{statValue(stats?.inactivity)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <HeartPulse className="h-4 w-4 text-primary" /> Legacy neglect comas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{statValue(stats?.legacyNeglect)}</CardContent>
          </Card>
        </div>

        <Alert>
          <HeartPulse className="h-4 w-4" />
          <AlertTitle>Current production behaviour</AlertTitle>
          <AlertDescription>
            Offline health decay is disabled. RockMundo uses a separate inactivity-coma rule:
            an account enters inactivity coma after 30 days with no account activity. Reviving is free
            and keeps career progress.
          </AlertDescription>
        </Alert>

        <Alert variant={comaHealth && !comaHealth.healthy ? "destructive" : "default"}>
          <HeartPulse className="h-4 w-4" />
          <AlertTitle>
            {healthLoading
              ? "Checking coma-system health…"
              : comaHealth?.healthy
                ? "Coma system healthy"
                : "Coma system needs attention"}
          </AlertTitle>
          <AlertDescription>
            {healthLoading ? (
              "Loading the live cron and account-safety checks."
            ) : comaHealth ? (
              `Cron: ${comaHealth.cron.last_status || "unknown"} · Active: ${comaHealth.cron.active ? "yes" : "no"} · Invalid inactivity snapshots: ${comaHealth.inactivity_snapshot_conflicts} · Missing snapshots: ${comaHealth.missing_activity_snapshots}`
            ) : (
              "Unable to load the live coma-system health summary."
            )}
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Operational health</CardTitle>
            <CardDescription>Live safeguards for the inactivity-coma system.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Decision conflicts</p>
              <p className="mt-1 text-2xl font-bold">{healthLoading ? "…" : comaHealth?.inactivity_snapshot_conflicts ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Coma entered despite less than 30 days of recorded inactivity</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Awaiting revival</p>
              <p className="mt-1 text-2xl font-bold">{healthLoading ? "…" : comaHealth?.recent_returners_in_coma ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Returned after coma entry with no living character and have not revived yet</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Missing snapshots</p>
              <p className="mt-1 text-2xl font-bold">{healthLoading ? "…" : comaHealth?.missing_activity_snapshots ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Inactivity comas without an auditable activity snapshot</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last cron run</p>
              <p className="mt-1 text-sm font-semibold">{healthLoading ? "Loading…" : formatDateTime(comaHealth?.cron.last_started_at ?? null)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{comaHealth?.cron.last_status || "Unknown status"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inactivity coma policy</CardTitle>
            <CardDescription>
              This reflects the live database function used by the scheduled coma job.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Threshold</p>
              <p className="mt-1 text-lg font-semibold">30 days without account activity</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Activity scope</p>
              <p className="mt-1 text-lg font-semibold">Whole account, not individual character slots</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Activity signals</p>
              <p className="mt-1 text-sm">
                Supabase sign-in activity plus the freshest character heartbeat from desktop or mobile gameplay.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Scheduled check</p>
              <p className="mt-1 text-sm">
                {comaHealth?.cron.schedule ? `Cron ${comaHealth.cron.schedule}` : "Daily at 03:30 UTC"} · latest run {comaHealth?.cron.last_status || "unknown"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent coma activity
              </CardTitle>
              <CardDescription>
                Latest coma entries and revivals from the authoritative audit trail.
              </CardDescription>
            </div>
            <Badge variant="outline">{recentEvents?.length ?? 0} shown</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {eventsLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading coma history…
              </div>
            ) : !recentEvents || recentEvents.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No coma activity has been recorded yet.</p>
            ) : (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={event.event_type === "entered" ? "destructive" : "secondary"}>
                        {event.event_type === "entered" ? "Entered coma" : "Revived"}
                      </Badge>
                      <span className="font-semibold">{event.characterName}</span>
                      {event.username ? <span className="text-xs text-muted-foreground">@{event.username}</span> : null}
                      <span className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {event.cause || "No stored cause"} · {sourceLabel(event.source)}
                    </p>
                    {event.account_last_activity_at ? (
                      <p className="text-[11px] text-muted-foreground">
                        Last account activity before coma: {formatDateTime(event.account_last_activity_at)}
                      </p>
                    ) : null}
                    <p className="text-[10px] font-mono text-muted-foreground/70">{event.profile_id}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(`/admin/character-recovery?search=${encodeURIComponent(event.profile_id)}`)
                    }
                  >
                    Inspect character
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Legacy death-system settings</CardTitle>
            <CardDescription>
              The old 24-hour stale threshold and offline health-drain settings are retained in historical
              configuration data only. They are not read by the current runtime and are no longer editable here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/admin/character-recovery")}>
              <HeartPulse className="mr-2 h-4 w-4" />
              Open Character Recovery
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin")}>
              Back to Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

export default DeathSystemAdmin;
