import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REPORT_CATEGORIES } from "@/services/socialSafety";

const STATUSES = ["submitted", "triage", "under_review", "awaiting_information", "action_taken", "no_action", "duplicate", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export default function AdminPlayerReports() {
  const queryClient = useQueryClient();
  const reports = useQuery({ queryKey: ["admin-player-reports"], queryFn: async () => {
    const { data, error } = await (supabase as any).from("player_reports").select("id, category, description, content_type, status, priority, submitted_at, reporter:profiles!player_reports_reporter_id_fkey(display_name, username), reported:profiles!player_reports_reported_player_id_fkey(display_name, username), player_report_evidence(id, evidence_type, snapshot, metadata, created_at)").order("submitted_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data ?? [];
  }});
  const update = useMutation({ mutationFn: async ({ id, patch }: { id: string; patch: Record<string, string> }) => {
    const { error } = await (supabase as any).from("player_reports").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-player-reports"] }) });
  const label = (value: string) => REPORT_CATEGORIES.find((item) => item.value === value)?.label ?? value;
  return <FMPageScaffold title="Player reports" subtitle="Moderation queue for player safety reports, evidence snapshots and triage state." icon={ShieldAlert} backTo="/admin" backLabel="Back to Admin"><div className="space-y-3">{reports.isLoading && <Card><CardContent className="p-6">Loading moderation queue…</CardContent></Card>}{reports.isError && <Card role="alert"><CardContent className="p-6 text-destructive">Report queue unavailable.</CardContent></Card>}{(reports.data ?? []).map((report: any) => <Card key={report.id}><CardContent className="space-y-3 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium">{label(report.category)}</p><p className="text-sm text-muted-foreground">Reported: {report.reported?.display_name || report.reported?.username || "Unknown"} · Reporter: {report.reporter?.display_name || report.reporter?.username || "Unknown"}</p></div><div className="flex gap-2"><Badge>{report.priority}</Badge><Badge variant="outline">{report.status}</Badge></div></div><p className="rounded-md bg-muted/40 p-3 text-sm">{report.description}</p><div className="grid gap-2 sm:grid-cols-2"><Select value={report.status} onValueChange={(status) => update.mutate({ id: report.id, patch: { status } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select><Select value={report.priority} onValueChange={(priority) => update.mutate({ id: report.id, patch: { priority } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div><details className="text-sm"><summary className="cursor-pointer">Evidence snapshots</summary><pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3">{JSON.stringify(report.player_report_evidence ?? [], null, 2)}</pre></details><Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: report.id, patch: { status: "under_review" } })}>Assign to review</Button></CardContent></Card>)}{!reports.isLoading && !(reports.data ?? []).length && <Card><CardContent className="p-6 text-center">No player reports in the queue.</CardContent></Card>}</div></FMPageScaffold>;
}
