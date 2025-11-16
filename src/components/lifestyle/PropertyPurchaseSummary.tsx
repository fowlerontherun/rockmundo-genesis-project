import { LifestyleProperty, LifestylePropertyFeature, LifestylePropertyFinancingOption } from "@/types/lifestyle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

interface PropertyPurchaseSummaryProps {
  property: LifestyleProperty | null;
  selectedFeatures: LifestylePropertyFeature[];
  totalUpgradeCost: number;
  purchasePrice: number;
  selectedFinancingOption: LifestylePropertyFinancingOption | null;
  monthlyPayment: number | null;
  onPurchase: () => Promise<void> | void;
  loading: boolean;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function PropertyPurchaseSummary({
  property,
  selectedFeatures,
  totalUpgradeCost,
  purchasePrice,
  selectedFinancingOption,
  monthlyPayment,
  onPurchase,
  loading,
}: PropertyPurchaseSummaryProps) {
  if (!property) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Purchase Summary</CardTitle>
        </div>
        <CardDescription>
          Review your selections before locking in this lifestyle investment. You can revisit your upgrades anytime before final confirmation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between text-sm">
            <span>Base Price</span>
            <span className="font-medium">
              {currencyFormatter.format(property.base_price)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Customization Upgrades</span>
            <span className="font-medium text-primary">
              +{currencyFormatter.format(totalUpgradeCost)}
            </span>
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Projected Purchase Price</span>
            <span className="text-xl font-semibold text-primary">
              {currencyFormatter.format(purchasePrice)}
            </span>
          </div>
        </div>

        {selectedFeatures.length > 0 ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Selected Enhancements</p>
            <div className="flex flex-wrap gap-2">
              {selectedFeatures.map((feature) => (
                <Badge key={feature.id} variant="outline" className="text-xs">
                  {feature.feature_name}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No upgrades selected yet. Explore customization tabs to personalize your space.
          </p>
        )}

        {selectedFinancingOption ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Financing Plan</p>
            <div className="rounded-md bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span>{selectedFinancingOption.name}</span>
                <Badge variant="secondary">{selectedFinancingOption.term_months} months</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{selectedFinancingOption.description}</p>
              {monthlyPayment !== null && (
                <p className="mt-2 text-sm font-semibold text-primary">
                  Estimated Monthly: {currencyFormatter.format(monthlyPayment)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a financing plan to preview monthly commitments.
          </p>
        )}

        <Button onClick={onPurchase} size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Finalize Lifestyle Purchase
        </Button>
      </CardContent>
    </Card>
  );
}
