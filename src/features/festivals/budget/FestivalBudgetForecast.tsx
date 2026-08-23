import { BadgePoundSterling, Handshake, TrendingDown, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFestivalBudgetForecast } from "./useFestivalBudgetForecast";

const formatMoney = (minor: number, currencyCode: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
  }).format(minor / 100);

export function FestivalBudgetForecast({
  festivalCompanyId,
  festivalEditionId,
}: {
  festivalCompanyId: string;
  festivalEditionId: string;
}) {
  const query = useFestivalBudgetForecast(festivalCompanyId, festivalEditionId);

  if (query.isLoading) {
    return <p role="status">Calculating Festival budget…</p>;
  }

  if (query.isError || !query.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget forecast unavailable</CardTitle>
          <CardDescription>
            Save the annual Festival plan and ticket choices, then try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const budget = query.data;
  const profitable = budget.projectedNetProfitMinor >= 0;

  return (
    <section className="space-y-4" aria-labelledby="festival-budget-title">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="festival-budget-title" className="flex items-center gap-2">
                <BadgePoundSterling className="h-5 w-5" /> Festival budget forecast
              </CardTitle>
              <CardDescription>
                The game combines ticket demand, food and drink, merchandise,
                automatic sponsorship and operating costs into one projection.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm font-medium">
              {profitable ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {profitable ? "Projected profit" : "Projected loss"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BudgetValue
            label="Ticket income"
            value={formatMoney(budget.ticketRevenueMinor, budget.currencyCode)}
          />
          <BudgetValue
            label="Automatic sponsorship"
            value={formatMoney(budget.sponsorshipRevenueMinor, budget.currencyCode)}
          />
          <BudgetValue
            label="Food & drink"
            value={formatMoney(budget.foodAndDrinkRevenueMinor, budget.currencyCode)}
          />
          <BudgetValue
            label="Merchandise"
            value={formatMoney(budget.merchandiseRevenueMinor, budget.currencyCode)}
          />
          <BudgetValue
            label="Projected revenue"
            value={formatMoney(budget.totalRevenueMinor, budget.currencyCode)}
          />
          <BudgetValue
            label="Operating cost"
            value={formatMoney(budget.operatingCostMinor, budget.currencyCode)}
          />
          <BudgetValue
            label="Expected attendance"
            value={budget.expectedAttendance.toLocaleString("en-GB")}
          />
          <BudgetValue
            label="Projected result"
            value={formatMoney(budget.projectedNetProfitMinor, budget.currencyCode)}
            emphasis
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Handshake className="h-4 w-4" /> Sponsorship is automatic
          </CardTitle>
          <CardDescription>
            Sponsor value is generated from Festival size, marketing demand,
            company reputation and the Marketing & Media upgrade. There is no
            separate sponsor-management screen to complete.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}

function BudgetValue({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={emphasis ? "rounded-lg border bg-background p-3" : "rounded-lg border bg-background/70 p-3"}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={emphasis ? "mt-1 text-xl font-semibold" : "mt-1 text-lg font-semibold"}>
        {value}
      </p>
    </div>
  );
}
