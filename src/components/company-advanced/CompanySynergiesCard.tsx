import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Check, Lock, Link2 } from "lucide-react";
import { useCompanySynergies, useActivateSynergy } from "@/hooks/useCompanyAdvanced";
import { SYNERGY_DEFINITIONS, type SynergyType } from "@/types/company-advanced";
import { toast } from "sonner";

interface CompanySynergiesCardProps {
  companyId: string;
  ownedBusinessTypes: string[];
}

export function CompanySynergiesCard({ companyId, ownedBusinessTypes }: CompanySynergiesCardProps) {
  const { data: synergies = [] } = useCompanySynergies(companyId);
  const activateSynergy = useActivateSynergy();

  const activeSynergyTypes = new Set(synergies.filter(s => s.is_active).map(s => s.synergy_type));

  const checkRequirements = (requires: string[]): boolean => {
    return requires.every(req => ownedBusinessTypes.includes(req));
  };

  const handleActivate = async (synergyType: SynergyType, discount: number) => {
    try {
      await activateSynergy.mutateAsync({
        company_id: companyId,
        synergy_type: synergyType,
        discount_percent: discount,
        is_active: true,
        requirements_met: true,
      });
      toast.success("Synergy activated! Discounts now apply to internal services.");
    } catch (error) {
      toast.error("Failed to activate synergy");
    }
  };

  const totalSavings = synergies
    .filter(s => s.is_active)
    .reduce((sum, s) => sum + s.discount_percent, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Business Synergies
            </CardTitle>
            <CardDescription>
              Unlock discounts by owning complementary businesses
            </CardDescription>
          </div>
          {totalSavings > 0 && (
            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
              Up to {totalSavings}% savings
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.entries(SYNERGY_DEFINITIONS) as [SynergyType, typeof SYNERGY_DEFINITIONS[SynergyType]][]).map(
            ([type, config]) => {
              const isActive = activeSynergyTypes.has(type);
              const meetsRequirements = checkRequirements(config.requires);

              return (
                <div
                  key={type}
                  className={`p-4 rounded-lg border ${
                    isActive
                      ? 'bg-success/5 border-success/30'
                      : meetsRequirements
                      ? 'bg-primary/5 border-primary/30 hover:border-primary/50'
                      : 'bg-muted/30 border-muted'
                  } transition-colors`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        {config.label}
                        {isActive && <Check className="h-4 w-4 text-success" />}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {config.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground">
                    <span>Requires:</span>
                    {config.requires.map((req, idx) => (
                      <Badge
                        key={req}
                        variant="outline"
                        className={`text-xs ${
                          ownedBusinessTypes.includes(req)
                            ? 'bg-success/10 text-success border-success/30'
                            : 'opacity-50'
                        }`}
                      >
                        {req}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-primary/10">
                      <Zap className="h-3 w-3 mr-1" />
                      {config.discount}% discount
                    </Badge>

                    {isActive ? (
                      <Badge variant="outline" className="bg-success/10 text-success">
                        Active
                      </Badge>
                    ) : meetsRequirements ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActivate(type, config.discount)}
                        disabled={activateSynergy.isPending}
                      >
                        Activate
                      </Button>
                    ) : (
                      <Badge variant="outline" className="opacity-50">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      </CardContent>
    </Card>
  );
}
