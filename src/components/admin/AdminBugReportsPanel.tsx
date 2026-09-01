import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, ExternalLink, RefreshCw, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type BugReport = {
  id: string;
  user_id: string | null;
  page_url: string | null;
  category: string;
  severity: string;
  title: string;
  description: string;
  steps_to_reproduce: string | null;
  user_agent: string | null;
  viewport: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = ["open", "investigating", "fixed", "closed"];

const severityVariant = (severity: string): "destructive" | "secondary" | "outline" => {
  if (severity === "critical" || severity === "high") return "destructive";
  if (severity === "medium") return "secondary";
  return "outline";
};

const AdminBugReportsPanel = () => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("bug_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (severityFilter !== "all") query = query.eq("severity", severityFilter);

    const { data, error } = await query;
    if (error) {
      toast.error("Could not load bug reports", { description: error.message });
    } else {
      setReports((data ?? []) as BugReport[]);
    }
    setLoading(false);
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-bug-report-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bug_reports" },
        () => void loadReports(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadReports]);

  const openCount = useMemo(
    () => reports.filter((report) => report.status === "open").length,
    [reports],
  );

  const updateReport = async (report: BugReport, patch: Partial<BugReport>) => {
    setSavingId(report.id);
    const { error } = await (supabase as any)
      .from("bug_reports")
      .update(patch)
      .eq("id", report.id);

    if (error) {
      toast.error("Could not update bug report", { description: error.message });
    } else {
      setReports((current) =>
        current.map((item) => (item.id === report.id ? { ...item, ...patch } : item)),
      );
      toast.success("Bug report updated");
    }
    setSavingId(null);
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-destructive" />
              Player Bug Reports
              {openCount > 0 && <Badge variant="destructive">{openCount} open</Badge>}
            </CardTitle>
            <CardDescription>
              Reports submitted from the in-game Log Bug button. New reports appear here automatically.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadReports()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading bug reports…</p>
        ) : reports.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            No reports match the current filters.
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{report.title}</h3>
                    <Badge variant={severityVariant(report.severity)}>{report.severity}</Badge>
                    <Badge variant="outline">{report.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(report.created_at).toLocaleString()} · {report.user_id ? `User ${report.user_id}` : "Anonymous"}
                  </p>
                </div>
                <Select
                  value={report.status}
                  onValueChange={(value) => void updateReport(report, { status: value })}
                  disabled={savingId === report.id}
                >
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <p className="whitespace-pre-wrap text-sm">{report.description}</p>

              {report.steps_to_reproduce && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Steps to reproduce</p>
                  <p className="whitespace-pre-wrap text-sm">{report.steps_to_reproduce}</p>
                </div>
              )}

              <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                {report.page_url && (
                  <a href={report.page_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> {report.page_url}
                  </a>
                )}
                <span>Viewport: {report.viewport ?? "unknown"}</span>
                <span className="md:col-span-2 break-all">Browser: {report.user_agent ?? "unknown"}</span>
              </div>

              {(report.severity === "critical" || report.severity === "high") && report.status === "open" && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" /> High-priority report awaiting review
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin notes</p>
                <Textarea
                  defaultValue={report.admin_notes ?? ""}
                  placeholder="Add investigation notes, fix reference, PR number, etc."
                  onBlur={(event) => {
                    const next = event.currentTarget.value.trim();
                    if (next !== (report.admin_notes ?? "")) {
                      void updateReport(report, { admin_notes: next || null });
                    }
                  }}
                  disabled={savingId === report.id}
                />
              </div>

              <div className="space-y-2 rounded-md border border-primary/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Reply to player {report.user_id ? "" : "(no player attached — reply disabled)"}
                </p>
                <Textarea
                  value={replyDrafts[report.id] ?? ""}
                  placeholder="Send an update that lands in the player's inbox…"
                  onChange={(event) =>
                    setReplyDrafts((current) => ({ ...current, [report.id]: event.target.value }))
                  }
                  disabled={!report.user_id || respondingId === report.id}
                />
                <Button
                  size="sm"
                  onClick={() => void sendReply(report)}
                  disabled={!report.user_id || respondingId === report.id || !(replyDrafts[report.id] ?? "").trim()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {respondingId === report.id ? "Sending…" : "Send update to player"}
                </Button>
              </div>

            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default AdminBugReportsPanel;
