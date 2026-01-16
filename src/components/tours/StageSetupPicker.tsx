import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { STAGE_SETUP_TIERS, StageSetupTier } from '@/lib/tourTypes';
import { Sparkles, Lock, Check, DollarSign, TrendingUp, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StageSetupPickerProps {
  value: StageSetupTier;
  onChange: (tier: StageSetupTier) => void;
  bandFame: number;
  showCount: number;
}

export function StageSetupPicker({ value, onChange, bandFame, showCount }: StageSetupPickerProps) {
  const selectedTier = STAGE_SETUP_TIERS[value];
  const totalCost = selectedTier.costPerShow * showCount;

  return (
    <div className="space-y-4">
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4" />
          Stage Setup & Production
        </Label>
        <p className="text-sm text-muted-foreground">
          Better production means higher merch sales and fame gains
        </p>
      </div>

      <RadioGroup value={value} onValueChange={(v) => onChange(v as StageSetupTier)}>
        <div className="grid gap-3">
          {(Object.entries(STAGE_SETUP_TIERS) as [StageSetupTier, typeof STAGE_SETUP_TIERS.basic][]).map(([key, tier]) => {
            const isLocked = bandFame < tier.minFame;
            const isSelected = value === key;
            
            return (
              <div
                key={key}
                className={cn(
                  "relative flex items-start space-x-3 p-4 border rounded-lg transition-colors",
                  isLocked && "opacity-50 cursor-not-allowed",
                  isSelected && "border-primary bg-primary/5",
                  !isLocked && !isSelected && "hover:border-muted-foreground/50"
                )}
              >
                <RadioGroupItem 
                  value={key} 
                  disabled={isLocked} 
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tier.label}</span>
                    {tier.costPerShow > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        ${tier.costPerShow.toLocaleString()}/show
                      </Badge>
                    )}
                    {tier.costPerShow === 0 && (
                      <Badge variant="outline" className="text-xs text-green-600">
                        Free
                      </Badge>
                    )}
                    {isLocked && (
                      <Badge variant="outline" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        {tier.minFame.toLocaleString()} fame
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <ShoppingBag className="h-3 w-3" />
                      Merch +{Math.round((tier.merchBoost - 1) * 100)}%
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Fame +{Math.round((tier.fameBoost - 1) * 100)}%
                    </span>
                  </div>
                </div>
                {isSelected && !isLocked && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </div>
            );
          })}
        </div>
      </RadioGroup>

      {/* Cost Summary */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Total Stage Setup Cost</span>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">
                ${totalCost.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {showCount} shows × ${selectedTier.costPerShow.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
