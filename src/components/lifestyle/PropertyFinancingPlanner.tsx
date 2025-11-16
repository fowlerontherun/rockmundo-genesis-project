import { LifestylePropertyFinancingOption } from "@/types/lifestyle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TrendingUp } from "lucide-react";

interface PropertyFinancingPlannerProps {
  purchasePrice: number;
  options: LifestylePropertyFinancingOption[];
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const calculateMonthlyPayment = (
  purchasePrice: number,
  option: LifestylePropertyFinancingOption
) => {
  const downPaymentAmount = purchasePrice * (option.down_payment_pct / 100);
  const financedAmount = Math.max(purchasePrice - downPaymentAmount, 0);
  const monthlyRate = option.interest_rate / 100 / 12;
  const closingCostMonthly = option.closing_cost_pct
    ? (purchasePrice * (option.closing_cost_pct / 100)) / option.term_months
    : 0;

  if (monthlyRate === 0) {
    return financedAmount / option.term_months + closingCostMonthly;
  }

  const payment =
    (financedAmount * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -option.term_months));

  return payment + closingCostMonthly;
};

export function PropertyFinancingPlanner({
  purchasePrice,
  options,
  selectedOptionId,
  onSelectOption,
}: PropertyFinancingPlannerProps) {
  if (options.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financing Planner</CardTitle>
          <CardDescription>
            Financing options for this property are still being negotiated with partner banks. Check back soon for exclusive artist programs.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Financing Planner</CardTitle>
        </div>
        <CardDescription>
          Compare curated financing plans designed for touring artists. Monthly costs adjust automatically as you add lifestyle upgrades.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted/40 p-4 text-sm">
          <p className="font-medium">Projected Purchase Price</p>
          <p className="text-2xl font-semibold text-primary">
            {currencyFormatter.format(purchasePrice)}
          </p>
        </div>

        <RadioGroup value={selectedOptionId ?? undefined} onValueChange={onSelectOption} className="space-y-4">
          {options.map((option) => {
            const downPaymentAmount = purchasePrice * (option.down_payment_pct / 100);
            const monthlyPayment = calculateMonthlyPayment(purchasePrice, option);
            const requirements = option.requirements
              ? Object.entries(option.requirements)
              : [];

            return (
              <Card
                key={option.id}
                className={option.id === selectedOptionId ? "border-primary/60" : "border-muted"}
              >
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                    <div className="space-y-1">
                      <Label htmlFor={option.id} className="text-base font-semibold">
                        {option.name}
                      </Label>
                      {option.description && (
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      )}
                      {requirements.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {requirements.map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {`${key}: ${value}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 text-right text-sm">
                    <div>
                      <p className="text-muted-foreground">Down Payment</p>
                      <p className="font-semibold">
                        {currencyFormatter.format(downPaymentAmount)} ({option.down_payment_pct}%)
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground">Estimated Monthly</p>
                      <p className="text-lg font-semibold text-primary">
                        {currencyFormatter.format(monthlyPayment)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {option.term_months} month term · {option.interest_rate}% APR
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
