import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wallet, TrendingUp, Lock, History as HistoryIcon, Coins } from "lucide-react";
import { format } from "date-fns";
import { useCityTreasury, useMayorActionsLog } from "@/hooks/useCityProjects";

interface Props {
  cityId: string;
  mayorSalary: number;
  corruptionScore: number;
}

export function MayorBudgetTab({ cityId, mayorSalary, corruptionScore }: Props) {
  const { data: treasury } = useCityTreasury(cityId);
  const { data: log } = useMayorActionsLog(cityId, 30);

  const balance = treasury?.balance ?? 0;
  const committed = treasury?.pending_commitments ?? 0;
  const available = balance - committed;
  const weeklyBudget = treasury?.weekly_budget ?? 0;
  const totalCollected = treasury?.total_tax_collected ?? 0;
  const totalSpent = treasury?.total_spent ?? 0;
  const salaryPaid = treasury?.salary_paid ?? 0;

  return (
    <div className="space-y-4">
      {/* Treasury overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Wallet} label="Balance" value={`$${balance.toLocaleString()}`} accent="text-foreground" />
        <StatCard icon={Lock} label="Committed" value={`$${committed.toLocaleString()}`} accent="text-warning" />
        <StatCard icon={Coins} label="Available" value={`$${available.toLocaleString()}`} accent="text-success" />
        <StatCard icon={TrendingUp} label="Weekly Budget" value={`$${weeklyBudget.toLocaleString()}`} accent="text-primary" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compensation & Integrity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Mayor salary (per week)" value={`$${mayorSalary.toLocaleString()}`} />
          <Row label="Total salary paid" value={`$${salaryPaid.toLocaleString()}`} />
          <Row
            label="Corruption score"
            value={
              <Badge variant={corruptionScore > 75 ? "destructive" : corruptionScore > 40 ? "outline" : "secondary"}>
                {corruptionScore} / 100
              </Badge>
            }
          />
          {corruptionScore > 75 && (
            <p className="text-xs text-destructive">
              ⚠ Corruption critically high — risk of recall election.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lifetime Treasury Activity</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Row label="Total tax collected" value={`$${totalCollected.toLocaleString()}`} />
          <Row label="Total spent" value={`$${totalSpent.toLocaleString()}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HistoryIcon className="h-4 w-4" /> Recent Mayor Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!log || log.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No actions recorded yet.</p>
          ) : (
            <ScrollArea className="h-72">
              <div className="space-y-2 pr-4">
                {log.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium capitalize">{entry.action_type.replace(/_/g, ' ')}</div>
                      {entry.notes && <div className="text-xs text-muted-foreground truncate">{entry.notes}</div>}
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      {entry.amount != null && (
                        <div className="text-xs font-medium">${Number(entry.amount).toLocaleString()}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "MMM d, HH:mm")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        <div className={`text-lg font-bold ${accent}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
