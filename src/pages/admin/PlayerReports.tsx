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

type ModerationPatch = {
  status?: string | null;
  priority?: string | null;
  assignToSelf?: boolean;
};

export default function AdminPlayerReports() {
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["admin-player-reports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_moderation_report_queue", {
        p_status: null,
        p_limit: 100,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ModerationPatch }) => {
      const { error } = await (supabase as any).rpc("moderate_player_report", {
        p_report_id: id,
        p_status: patch.status ?? null,
        p_priority: patch.priority ?? null,
        p_resolution_summary: null,
        p_note: null,
        p_assign_to_self: patch.assignToSelf ?? false,
        p_duplicate_of_report_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-player-reports"] }),
  });

  const label = (value: string) => REPORT_CATEGORIES.find((item) => item.value === value)?.label ?? value.replace(/_/g, " ");

  return (
    <FMPageScaffold
      title="Player reports"
      subtitle="Unified moderation queue with authoritative evidence snapshots and audited moderator actions."
      icon={ShieldAlert}
      backTo="/admin"
      backLabel="Back to Admin"
    >
      <div className="space-y-3">
        {reports.isLoading && <Card><CardContent className="p-6">Loading moderation queue…</CardContent></Card>}
        {reports.isError && <Card role="alert"><CardContent className="p-6 text-destructive">Report queue unavailable.</CardContent></Card>}
        {(reports.data ?? []).map((report: any) => (
          <Card key={report.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{label(report.category)}</p>
                  <p className="text-sm text-muted-foreground">
                    Reported: {report.reported?.display_name || report.reported?.username || report.target_type || "Content"}
                    {" · "}Reporter: {report.reporter?.display_name || report.reporter?.username || "Unknown"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{String(report.target_type || report.content_type || "content").replace(/_/g, " ")}</Badge>
                  <Badge>{report.priority}</Badge>
                  <Badge variant="outline">{report.status}</Badge>
                </div>
              </div>

              <p className="rounded-md bg-muted/40 p-3 text-sm">{report.description}</p>

              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={report.status}
                  onValueChange={(status) => update.mutate({ id: report.id, patch: { status } })}
                  disabled={update.isPending}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={report.priority}
                  onValueChange={(priority) => update.mutate({ id: report.id, patch: { priority } })}
                  disabled={update.isPending}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer">Server evidence ({report.evidence?.length ?? 0})</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(report.evidence ?? [], null, 2)}
                </pre>
              </details>

              <details className="text-sm">
                <summary className="cursor-pointer">Moderator audit trail ({report.audit?.length ?? 0})</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(report.audit ?? [], null, 2)}
                </pre>
              </details>

              <Button
                size="sm"
                variant="outline"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: report.id, patch: { status: "under_review", assignToSelf: true } })}
              >
                Assign to review
              </Button>
            </CardContent>
          </Card>
        ))}
        {!reports.isLoading && !(reports.data ?? []).length && <Card><CardContent className="p-6 text-center">No player reports in the queue.</CardContent></Card>}
      </div>
    </FMPageScaffold>
  );
}
