import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldAlert, Archive, Trash2, Power } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useMaintenanceState,
  useResetPreview,
  useResetArchives,
  useEnableMaintenance,
  useDisableMaintenance,
  useExecuteWorldReset,
} from "@/hooks/useWorldReset";

const CONFIRM_PHRASE = "RESET WORLD";

export default function WorldReset() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { data: state } = useMaintenanceState();
  const { data: preview } = useResetPreview(isAdmin());
  const { data: archives } = useResetArchives();
  const enableMaint = useEnableMaintenance();
  const disableMaint = useDisableMaintenance();
  const execReset = useExecuteWorldReset();

  const [message, setMessage] = useState("World reset incoming — wrap up any in-progress activities.");
  const [minutes, setMinutes] = useState(10);
  const [confirm, setConfirm] = useState("");

  const scheduledAt = state?.scheduled_reset_at ? new Date(state.scheduled_reset_at) : null;
  const ready = !!(state?.is_active && scheduledAt && scheduledAt.getTime() <= Date.now());

  const { wipe, preserve } = useMemo(() => {
    const w = (preview ?? []).filter((p) => p.action === "wipe");
    const p = (preview ?? []).filter((p) => p.action === "preserve");
    return { wipe: w, preserve: p };
  }, [preview]);

  if (roleLoading) return <div className="p-6">Loading…</div>;
  if (!isAdmin()) {
    return (
      <Alert variant="destructive" className="m-6 max-w-xl">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Admin only</AlertTitle>
        <AlertDescription>You need admin role to access World Reset.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" /> World Reset
        </h1>
        <p className="text-sm text-muted-foreground">
          Wipe all gameplay data and restart from the Jan 1, 2026 epoch. Curated catalogs and user accounts are preserved.
        </p>
      </div>

      {/* Maintenance Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Power className="h-4 w-4" /> 1. Maintenance Mode</CardTitle>
          <CardDescription>
            Broadcast a warning banner to all players and start the countdown. The reset cannot run until this is active and the scheduled time has passed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state?.is_active ? (
            <Alert>
              <AlertTitle>Maintenance is ACTIVE</AlertTitle>
              <AlertDescription className="space-y-1 text-xs">
                <div>Scheduled reset: {scheduledAt?.toLocaleString() ?? "n/a"}</div>
                <div>Message: {state.message}</div>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Banner message</Label>
                <Input value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Countdown (minutes)</Label>
                <Input type="number" min={1} max={1440} value={minutes}
                       onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))} />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {state?.is_active ? (
              <Button variant="outline" onClick={() => disableMaint.mutate()} disabled={disableMaint.isPending}>
                Cancel maintenance
              </Button>
            ) : (
              <Button
                onClick={() => enableMaint.mutate({ message, scheduledAt: new Date(Date.now() + minutes * 60_000) })}
                disabled={enableMaint.isPending}
              >
                Enable maintenance & start countdown
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>2. Tables affected</CardTitle>
          <CardDescription>
            {wipe.length} tables will be wiped · {preserve.length} preserved. Edit the preserve list via the <code>world_reset_preserve_list</code> table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold mb-1 text-destructive">Will be wiped ({wipe.length})</div>
              <ScrollArea className="h-56 rounded border p-2">
                {wipe.map((t) => (
                  <div key={t.table_name} className="text-[11px] font-mono">{t.table_name}</div>
                ))}
              </ScrollArea>
            </div>
            <div>
              <div className="text-xs font-semibold mb-1 text-emerald-600">Preserved ({preserve.length})</div>
              <ScrollArea className="h-56 rounded border p-2">
                {preserve.map((t) => (
                  <div key={t.table_name} className="text-[11px] font-mono flex justify-between gap-2">
                    <span>{t.table_name}</span>
                    <span className="text-muted-foreground truncate">{t.reason}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Archives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Archive className="h-4 w-4" /> 3. Previous archives</CardTitle>
          <CardDescription>Each reset archives wiped tables into a timestamped schema. Only the most recent 3 are retained.</CardDescription>
        </CardHeader>
        <CardContent>
          {!archives?.length ? (
            <div className="text-xs text-muted-foreground">No prior resets.</div>
          ) : (
            <div className="space-y-1">
              {archives.map((a) => (
                <div key={a.schema_name} className="flex items-center justify-between text-xs">
                  <code>{a.schema_name}</code>
                  <Badge variant="outline">{a.table_count} tables</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execute */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" /> 4. Execute reset
          </CardTitle>
          <CardDescription>
            Type <code className="bg-muted px-1">{CONFIRM_PHRASE}</code> below to confirm. The button enables once maintenance is active and the countdown has elapsed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder={`Type "${CONFIRM_PHRASE}" to enable the button`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {!ready && state?.is_active && scheduledAt && (
            <div className="text-xs text-muted-foreground">
              Waiting for countdown to elapse ({scheduledAt.toLocaleString()}).
            </div>
          )}
          {!state?.is_active && (
            <div className="text-xs text-muted-foreground">Enable maintenance mode first.</div>
          )}
          <Button
            variant="destructive"
            disabled={!ready || confirm !== CONFIRM_PHRASE || execReset.isPending}
            onClick={() => execReset.mutate(confirm)}
          >
            {execReset.isPending ? "Resetting world…" : "Wipe the world"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
