import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, BarChart3, CheckCircle2, ShieldAlert } from "lucide-react";
import { useMayorActionsLog } from "@/hooks/useCityProjects";
import { MayorPromiseTracker } from "@/components/city/MayorPromiseTracker";

interface Props {
  cityId: string;
  mayor: any;
}

export function MayorPublicOpinionTab({ cityId, mayor }: Props) {
  const { data: actions } = useMayorActionsLog(cityId, 12);
  const approval = Number(mayor?.approval_rating ?? 50);
  const corruption = Number(mayor?.corruption_score ?? 0);
  const policies = Number(mayor?.policies_enacted ?? 0);
  const projects = Number(mayor?.projects_completed ?? 0);

  const approvalBand = approval >= 65 ? "Strong" : approval >= 50 ? "Stable" : approval >= 35 ? "Fragile" : "Critical";
  const integrityBand = corruption <= 25 ? "High integrity" : corruption <= 50 ? "Watchlist" : corruption <= 75 ? "Damaged" : "Critical";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <OpinionMetric label="Approval" value={`${approval.toFixed(0)}%`} badge={approvalBand} />
        <OpinionMetric label="Integrity" value={`${Math.max(0, 100 - corruption).toFixed(0)} / 100`} badge={integrityBand} />
        <OpinionMetric label="Policies enacted" value={String(policies)} badge="This term" />
        <OpinionMetric label="Projects completed" value={String(projects)} badge="This term" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" /> Approval pressure</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Public approval</span><span>{approval.toFixed(1)}%</span></div>
              <Progress value={approval} className="h-2.5" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Integrity</span><span>{Math.max(0, 100 - corruption).toFixed(0)}%</span></div>
              <Progress value={Math.max(0, 100 - corruption)} className="h-2.5" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Signal
                icon={approval >= 50 ? CheckCircle2 : AlertTriangle}
                title={approval >= 50 ? "Mandate holding" : "Mandate under pressure"}
                detail={approval >= 50 ? "Approval is above the 50% line." : "Approval is below 50%; unpopular decisions carry more political risk."}
              />
              <Signal
                icon={corruption <= 40 ? CheckCircle2 : ShieldAlert}
                title={corruption <= 40 ? "Integrity acceptable" : "Integrity risk rising"}
                detail={corruption <= 40 ? "Corruption remains below the main warning band." : "High corruption damages the administration and can increase recall risk."}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent decisions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!actions?.length ? (
              <p className="text-sm text-muted-foreground">No mayoral decisions recorded yet.</p>
            ) : actions.slice(0, 8).map((action) => (
              <div key={action.id} className="rounded-lg border p-2.5">
                <div className="text-sm font-medium capitalize">{action.action_type.replace(/_/g, " ")}</div>
                {action.notes && <div className="mt-0.5 text-xs text-muted-foreground">{action.notes}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <MayorPromiseTracker cityId={cityId} />
    </div>
  );
}

function OpinionMetric({ label, value, badge }: { label: string; value: string; badge: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="my-1 text-2xl font-semibold">{value}</div>
        <Badge variant="secondary">{badge}</Badge>
      </CardContent>
    </Card>
  );
}

function Signal({ icon: Icon, title, detail }: { icon: any; title: string; detail: string }) {
  return (
    <div className="rounded-lg border bg-muted/15 p-3">
      <div className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4" /> {title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
