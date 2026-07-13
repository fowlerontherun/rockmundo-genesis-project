import { FileWarning } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { REPORT_CATEGORIES } from "@/services/socialSafety";
import { useMyReports } from "@/hooks/useSocialSafety";

export default function MyReportsPage() {
  const reports = useMyReports();
  const label = (value: string) => REPORT_CATEGORIES.find((item) => item.value === value)?.label ?? value;
  return <FMPageScaffold title="My reports" subtitle="View limited status for reports you submitted. Moderator notes, identities and disciplinary details are private." icon={FileWarning} backTo="/social" backLabel="Back to Social">{reports.isLoading && <Card><CardContent className="p-6" aria-live="polite">Loading reports…</CardContent></Card>}{reports.isError && <Card role="alert"><CardContent className="p-6 text-destructive">Moderation status unavailable.</CardContent></Card>}{!reports.isLoading && !reports.isError && !(reports.data ?? []).length && <Card><CardContent className="p-6 text-center">No previous reports.</CardContent></Card>}<div className="space-y-3">{(reports.data ?? []).map((report) => <Card key={report.id}><CardContent className="space-y-2 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{label(report.category)}</p><p className="text-sm text-muted-foreground">{report.reportedPlayerName} · submitted {new Date(report.submittedAt).toLocaleDateString()}</p></div><Badge variant="outline">{report.status.replace(/_/g, " ")}</Badge></div>{report.resolutionSummary && <p className="text-sm">{report.resolutionSummary}</p>}<p className="text-xs text-muted-foreground">Last updated {new Date(report.updatedAt).toLocaleDateString()}</p></CardContent></Card>)}</div></FMPageScaffold>;
}
