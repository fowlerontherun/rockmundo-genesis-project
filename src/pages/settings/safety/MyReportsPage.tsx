import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileWarning } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchMyReports } from "@/services/social-safety/PlayerReportService";

const statusLabel: Record<string, string> = { open: "Submitted", triaged: "Under review", actioned: "Resolved", dismissed: "Closed" };
export default function MyReportsPage() { const { data = [], isLoading, isError } = useQuery({ queryKey: ["my-reports"], queryFn: fetchMyReports }); return <FMPageScaffold title="My Reports" subtitle="View limited status for reports you submitted." icon={FileWarning} backTo="/settings">{isLoading && <Card><CardContent className="p-6 text-center text-muted-foreground">Loading reports…</CardContent></Card>}{isError && <Card role="alert"><CardContent className="p-6 text-center text-destructive">Report status is unavailable right now.</CardContent></Card>}{!isLoading && !isError && data.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">No previous reports.</CardContent></Card>}{data.map((report: any) => <Card key={report.id}><CardContent className="flex items-center justify-between gap-3 p-4"><div><div className="font-medium capitalize">{String(report.category).replace(/_/g, " ")}</div><div className="text-sm text-muted-foreground">Submitted {format(new Date(report.created_at), "PP")}</div></div><Badge>{statusLabel[report.status] ?? "Submitted"}</Badge></CardContent></Card>)}</FMPageScaffold>; }
