import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, DollarSign, Percent } from "lucide-react";
import { useCompanyInternalServices } from "@/hooks/useCompanyAdvanced";
import { format } from "date-fns";

interface CompanyInternalServicesLogProps {
  companyId: string;
}

export function CompanyInternalServicesLog({ companyId }: CompanyInternalServicesLogProps) {
  const { data: services = [], isLoading } = useCompanyInternalServices(companyId);

  const totalSavings = services.reduce((sum, s) => sum + s.discount_applied, 0);
  const totalSpent = services.reduce((sum, s) => sum + s.final_cost, 0);

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Loading services...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowRightLeft className="h-5 w-5" />
              Internal Services
            </CardTitle>
            <CardDescription>
              Cross-business service usage and savings
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Savings</p>
            <p className="font-bold text-success">${totalSavings.toLocaleString()}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No internal services used yet</p>
            <p className="text-sm">Use services between your businesses to unlock synergy discounts</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {services.slice(0, 20).map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {service.provider_type.replace('_', ' ')}
                    </Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="secondary" className="capitalize">
                      {service.consumer_type}
                    </Badge>
                  </div>
                  <p className="text-sm mt-1">{service.service_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(service.service_date), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    {service.discount_applied > 0 && (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        <Percent className="h-3 w-3 mr-1" />
                        -{((service.discount_applied / service.original_cost) * 100).toFixed(0)}%
                      </Badge>
                    )}
                    <span className="font-medium">${service.final_cost.toLocaleString()}</span>
                  </div>
                  {service.discount_applied > 0 && (
                    <p className="text-xs text-muted-foreground line-through">
                      ${service.original_cost.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
