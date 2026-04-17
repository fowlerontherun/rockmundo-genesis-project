import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, XCircle, MinusCircle, ScrollText } from "lucide-react";
import { useMayorPromiseReport, type PromiseStatus } from "@/hooks/useMayorPromiseReport";
import { LAW_FIELD_LABELS, DRUG_POLICY_LABELS } from "@/types/city-governance";
import type { DrugPolicyStatus } from "@/types/city-governance";

interface Props {
  cityId: string;
  compact?: boolean;
}

const STATUS_META: Record<PromiseStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  fulfilled: { label: "Fulfilled", icon: CheckCircle2, cls: "text-success" },
  in_progress: { label: "In Progress", icon: Clock, cls: "text-warning" },
  broken: { label: "Broken", icon: XCircle, cls: "text-destructive" },
  untouched: { label: "Untouched", icon: MinusCircle, cls: "text-muted-foreground" },
};

function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ") : "(none)";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (field === "drug_policy") return DRUG_POLICY_LABELS[v as DrugPolicyStatus] ?? String(v);
  if (field.endsWith("_rate") || field === "travel_tax") return `${v}%`;
  if (field === "noise_curfew_hour") return `${v}:00`;
  if (
    field === "busking_license_fee" ||
    field === "venue_permit_cost" ||
    field === "community_events_funding"
  ) {
    return `$${Number(v).toLocaleString()}`;
  }
  return String(v);
}

export function MayorPromiseTracker({ cityId, compact = false }: Props) {
  const { data: report, isLoading } = useMayorPromiseReport(cityId);

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg" />;
  }

  if (!report || report.totalPromises === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" /> Promise Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The current mayor made no formal campaign promises to track.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> Promise Tracker
          </span>
          <Badge variant="outline" className="text-sm">
            Score: {report.fulfillmentScore}%
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Comparing this mayor's campaign promises against the current city laws.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={report.fulfillmentScore} className="h-2" />

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <p className="text-success font-semibold">{report.fulfilledCount}</p>
            <p className="text-muted-foreground">Fulfilled</p>
          </div>
          <div>
            <p className="text-warning font-semibold">{report.inProgressCount}</p>
            <p className="text-muted-foreground">In Progress</p>
          </div>
          <div>
            <p className="text-destructive font-semibold">{report.brokenCount}</p>
            <p className="text-muted-foreground">Broken</p>
          </div>
          <div>
            <p className="text-muted-foreground font-semibold">{report.untouchedCount}</p>
            <p className="text-muted-foreground">Untouched</p>
          </div>
        </div>

        {!compact && (
          <ul className="space-y-1.5 pt-1">
            {report.promises.map((p) => {
              const meta = STATUS_META[p.status];
              const Icon = meta.icon;
              return (
                <li
                  key={p.field}
                  className="flex items-start gap-2 p-2 rounded-md border border-border text-xs"
                >
                  <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${meta.cls}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold">
                        {LAW_FIELD_LABELS[p.field] ?? p.field}
                      </span>
                      <Badge variant="outline" className={`${meta.cls} text-[10px]`}>
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      Promised <span className="text-foreground">{formatValue(p.field, p.promised)}</span>
                      {" · "}Now <span className="text-foreground">{formatValue(p.field, p.current)}</span>
                    </p>
                    {p.status === "in_progress" && p.numericProgressPct !== undefined && (
                      <Progress value={p.numericProgressPct} className="h-1 mt-1.5" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
