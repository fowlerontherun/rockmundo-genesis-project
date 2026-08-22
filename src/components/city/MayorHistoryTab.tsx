import { format } from "date-fns";
import { BookOpen, Crown, FileClock, Gavel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMayorHistory } from "@/hooks/useMayorDashboard";
import { useMayorActionsLog } from "@/hooks/useCityProjects";
import { useCityLawHistory } from "@/hooks/useCityLaws";
import { LAW_FIELD_LABELS } from "@/types/city-governance";

export function MayorHistoryTab({ cityId }: { cityId: string }) {
  const { data: actions } = useMayorActionsLog(cityId, 50);
  const { data: lawHistory } = useCityLawHistory(cityId);
  const { data: mayors } = useMayorHistory(cityId);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileClock className="h-4 w-4" /> City Hall activity</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[430px] pr-4">
            <div className="space-y-2">
              {!actions?.length ? <p className="text-sm text-muted-foreground">No mayoral actions recorded.</p> : actions.map((action) => (
                <div key={action.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-medium capitalize">{action.action_type.replace(/_/g, " ")}</div>
                    <span className="text-xs text-muted-foreground">{format(new Date(action.created_at), "d MMM yyyy, HH:mm")}</span>
                  </div>
                  {action.notes && <div className="mt-1 text-xs text-muted-foreground">{action.notes}</div>}
                  {action.amount != null && <Badge variant="secondary" className="mt-2">${Number(action.amount).toLocaleString()}</Badge>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gavel className="h-4 w-4" /> Law changes</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-56 pr-4">
              <div className="space-y-2">
                {!lawHistory?.length ? <p className="text-sm text-muted-foreground">No law history recorded.</p> : lawHistory.slice(0, 30).map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{LAW_FIELD_LABELS[entry.law_field] ?? entry.law_field.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(entry.changed_at), "d MMM yyyy")}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{entry.old_value ?? "—"} → {entry.new_value}</div>
                    {entry.change_reason && <div className="mt-1 text-xs">{entry.change_reason}</div>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Crown className="h-4 w-4" /> Previous administrations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!mayors?.length ? <p className="text-sm text-muted-foreground">No mayor history recorded.</p> : mayors.slice(0, 8).map((mayor) => (
              <div key={mayor.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <div className="font-medium">{mayor.profile?.stage_name ?? "Mayor"}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(mayor.term_start), "d MMM yyyy")}{mayor.term_end ? ` – ${format(new Date(mayor.term_end), "d MMM yyyy")}` : " – present"}
                  </div>
                </div>
                <Badge variant={mayor.is_current ? "default" : "outline"}>{mayor.is_current ? "Current" : `${Number(mayor.approval_rating ?? 50).toFixed(0)}% approval`}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
