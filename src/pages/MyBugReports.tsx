import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, CheckCircle2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type BugReportRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  created_at: string;
};

type ResponseRow = {
  id: string;
  bug_report_id: string;
  responder_type: "admin" | "player";
  message: string;
  status_at_response: string | null;
  created_at: string;
};

type BugReportWithResponses = BugReportRow & {
  responses: ResponseRow[];
};

export default function MyBugReportsPage() {
  const queryClient = useQueryClient();
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["my-bug-reports"],
    queryFn: async () => {
      const { data: reports, error } = await (supabase as any)
        .from("bug_reports")
        .select("id,title,description,category,severity,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const list = (reports ?? []) as BugReportRow[];
      let responses: ResponseRow[] = [];
      if (list.length) {
        const { data: responseRows, error: responseError } = await (supabase as any)
          .from("bug_report_responses")
          .select("id,bug_report_id,responder_type,message,status_at_response,created_at")
          .in("bug_report_id", list.map((report) => report.id))
          .order("created_at", { ascending: true });
        if (responseError) throw responseError;
        responses = (responseRows ?? []) as ResponseRow[];
      }

      return list.map((report) => ({
        ...report,
        responses: responses.filter((response) => response.bug_report_id === report.id),
      })) as BugReportWithResponses[];
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ reportId, message, confirmFixed }: { reportId: string; message: string; confirmFixed: boolean }) => {
      const { error } = await (supabase as any).rpc("reply_to_bug_report", {
        p_report_id: reportId,
        p_message: message,
        p_confirm_fixed: confirmFixed,
      });
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      setReplyDrafts((current) => ({ ...current, [variables.reportId]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["my-bug-reports"] });
      toast.success(variables.confirmFixed ? "Bug marked as fixed" : "Reply sent to the team");
    },
    onError: (error: Error) => {
      toast.error("Could not send your reply", { description: error.message });
    },
  });

  const sendReply = (reportId: string) => {
    const message = (replyDrafts[reportId] ?? "").trim();
    if (!message) return;
    replyMutation.mutate({ reportId, message, confirmFixed: false });
  };

  const confirmFixed = (reportId: string) => {
    const message = (replyDrafts[reportId] ?? "").trim();
    replyMutation.mutate({ reportId, message, confirmFixed: true });
  };

  return (
    <FMPageScaffold
      title="My bug reports"
      subtitle="Track the bugs you reported and talk directly with the team."
      icon={Bug}
      backTo="/inbox"
      backLabel="Back to Inbox"
    >
      <div className="space-y-3">
        {query.isLoading && (
          <Card><CardContent className="p-6" aria-live="polite">Loading your bug reports…</CardContent></Card>
        )}
        {query.isError && (
          <Card role="alert"><CardContent className="p-6 text-destructive">Bug reports could not be loaded.</CardContent></Card>
        )}
        {!query.isLoading && !query.isError && !(query.data ?? []).length && (
          <Card><CardContent className="p-6 text-center">You haven't reported any bugs yet.</CardContent></Card>
        )}
        {(query.data ?? []).map((report) => {
          const isReplying = replyMutation.isPending && replyMutation.variables?.reportId === report.id;
          const draft = replyDrafts[report.id] ?? "";

          return (
            <Card key={report.id}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{report.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(report.created_at).toLocaleString()} · {report.category} · {report.severity}
                    </p>
                  </div>
                  <Badge variant="outline">{report.status}</Badge>
                </div>

                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{report.description}</p>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversation</p>
                  {report.responses.length === 0 ? (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      No replies yet. The team will respond here when there is an update.
                    </div>
                  ) : (
                    report.responses.map((response) => (
                      <div
                        key={response.id}
                        className={`rounded-md border p-3 ${response.responder_type === "player" ? "ml-4 bg-primary/5" : "mr-4 bg-muted/40"}`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">
                            {response.responder_type === "player" ? "You" : "RockMundo team"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(response.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{response.message}</p>
                        {response.status_at_response && (
                          <p className="mt-1 text-xs text-muted-foreground">Status: {response.status_at_response}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 rounded-md border border-primary/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reply to the team</p>
                  <Textarea
                    value={draft}
                    placeholder="Tell us whether the fix worked or add more information…"
                    onChange={(event) => setReplyDrafts((current) => ({ ...current, [report.id]: event.target.value }))}
                    disabled={isReplying}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => sendReply(report.id)}
                      disabled={isReplying || !draft.trim()}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isReplying ? "Sending…" : "Send reply"}
                    </Button>
                    {report.status === "fixed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => confirmFixed(report.id)}
                        disabled={isReplying}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirm fix & close
                      </Button>
                    )}
                  </div>
                  {report.status === "fixed" && (
                    <p className="text-xs text-muted-foreground">
                      Confirming the fix records your confirmation in this conversation and closes the report.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </FMPageScaffold>
  );
}
