import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Heart, HeartPulse, Loader2, Skull } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DeathSystemAdmin = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
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

  const statValue = (value?: number) =>
    isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <span>{value ?? 0}</span>;

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Character Coma & Recovery</h1>
            <p className="text-sm text-muted-foreground">
              Monitor the live inactivity-coma policy and character recovery state.
            </p>
          </div>
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
            Offline health decay is disabled. RockMundo now uses a separate inactivity-coma rule:
            an account enters inactivity coma after 30 days with no account activity. Reviving is free
            and keeps career progress.
          </AlertDescription>
        </Alert>

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
              <p className="mt-1 text-sm">Daily at 03:30 UTC via the existing inactivity-coma cron job.</p>
            </div>
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
