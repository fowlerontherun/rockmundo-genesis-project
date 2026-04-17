import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Vote } from "lucide-react";
import { useMayorPaySettings, useMyMayorSalaryHistory } from "@/hooks/useParliament";
import { formatDistanceToNow } from "date-fns";

export function MayorPayPanel() {
  const { data: settings } = useMayorPaySettings();
  const { data: history } = useMyMayorSalaryHistory();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Current Weekly Mayor Salary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            ${((settings?.weekly_salary_per_mayor ?? 0) / 100).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Bounds: ${((settings?.min_salary ?? 0) / 100).toLocaleString()} – $
            {((settings?.max_salary ?? 0) / 100).toLocaleString()}. Set by passed `mayor_pay` motions.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Vote className="h-4 w-4" />
            Your Salary History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {history.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(p.paid_at), { addSuffix: true })}
                  </span>
                  <span className="font-medium">${(p.amount / 100).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
