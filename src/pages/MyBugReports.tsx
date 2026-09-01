import { useQuery } from "@tanstack/react-query";
import { Bug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
  message: string;
  status_at_response: string | null;
  created_at: string;
};

export default function MyBugReportsPage() {
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
          .select("id,bug_report_id,message,status_at_response,created_at")
          .in("bug_report_id", list.map((report) => report.id))
          .order("created_at", { ascending: false });
        if (responseError) throw responseError;
        responses = (responseRows ?? []) as ResponseRow[];
      }

      return list.map((report) => ({
        ...report,
        responses: responses.filter((response) => response.bug_report_id === report.id),
      }));
    },
  });

  return (
    <FMPageScaffold
      title="My bug reports"
      subtitle="Track the bugs you reported and read updates from the team."
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
        {(query.data ?? []).map((report) => (
          <Card key={report.id}>
            <CardContent className="space-y-3 p-4">
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
              {report.responses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updates from the team</p>
                  {report.responses.map((response) => (
                    <div key={response.id} className="rounded-md border bg-muted/40 p-3">
                      <p className="whitespace-pre-wrap text-sm">{response.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(response.created_at).toLocaleString()}
                        {response.status_at_response ? ` · status: ${response.status_at_response}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </FMPageScaffold>
  );
}
