import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Lock, Star, ChevronDown, ChevronUp, DollarSign, TrendingUp, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STAGE_COMPONENT_CATEGORIES,
  type StageComponentSelections,
  type StageComponentType,
  calculateProductionRating,
  calculateTotalStageCostPerShow,
  calculateTotalHaulWeight,
  getHaulRequirement,
  getStageFameBoost,
  getStageMerchBoost,
  getSelectedOption,
} from '@/lib/tourStageComponents';

interface StageEquipmentBuilderProps {
  selections: StageComponentSelections;
  onChange: (selections: StageComponentSelections) => void;
  bandFame: number;
  showCount: number;
}

const RATING_COLORS = [
  'bg-destructive', // 0-19
  'bg-orange-500',   // 20-39
  'bg-yellow-500',   // 40-59
  'bg-green-500',    // 60-79
  'bg-primary',      // 80-100
];

function getRatingColor(rating: number) {
  if (rating < 20) return RATING_COLORS[0];
  if (rating < 40) return RATING_COLORS[1];
  if (rating < 60) return RATING_COLORS[2];
  if (rating < 80) return RATING_COLORS[3];
  return RATING_COLORS[4];
}

function getRatingLabel(rating: number) {
  if (rating < 15) return 'Garage Level';
  if (rating < 30) return 'Club Ready';
  if (rating < 50) return 'Professional';
  if (rating < 70) return 'Festival Grade';
  if (rating < 85) return 'Arena Production';
  return 'World Tour Spectacular';
}

export function StageEquipmentBuilder({ selections, onChange, bandFame, showCount }: StageEquipmentBuilderProps) {
  const [expandedCategory, setExpandedCategory] = useState<StageComponentType | null>(null);
  
  const productionRating = calculateProductionRating(selections);
  const costPerShow = calculateTotalStageCostPerShow(selections);
  const totalCost = costPerShow * showCount;
  const haulWeight = calculateTotalHaulWeight(selections);
  const haulReq = getHaulRequirement(haulWeight);
  const merchBoost = getStageMerchBoost(productionRating);
  const fameBoost = getStageFameBoost(productionRating);

  const updateSelection = (type: StageComponentType, key: string) => {
    onChange({ ...selections, [type]: key });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <Star className="h-4 w-4" />
          Stage Production
        </Label>
        <p className="text-sm text-muted-foreground">
          Build your show component by component
        </p>
      </div>

      {/* Production Rating Gauge */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Production Rating</p>
              <p className="text-3xl font-black tabular-nums">{productionRating}<span className="text-sm text-muted-foreground font-normal">/100</span></p>
            </div>
            <Badge variant="outline" className={cn("text-sm font-semibold px-3 py-1", getRatingColor(productionRating), "text-white border-0")}>
              {getRatingLabel(productionRating)}
            </Badge>
          </div>
          <Progress value={productionRating} className="h-3" />
          
          {/* Component breakdown mini bars */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {STAGE_COMPONENT_CATEGORIES.map((cat) => {
              const selected = getSelectedOption(cat.type, selections[cat.type]);
              const rating = selected?.rating || 0;
              return (
                <div key={cat.type} className="text-center">
                  <p className="text-[9px] text-muted-foreground truncate">{cat.icon} {cat.label}</p>
                  <div className="flex justify-center gap-0.5 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-2.5 w-2.5",
                          i < rating ? "fill-yellow-500 text-yellow-500" : "text-muted/50"
                        )}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Boosts */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground border-t pt-2">
            <span className="flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              Merch +{Math.round((merchBoost - 1) * 100)}%
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Fame +{Math.round((fameBoost - 1) * 100)}%
            </span>
            <span className="flex items-center gap-1">
              📦 Haul: {haulReq}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Component Selectors */}
      <div className="space-y-2">
        {STAGE_COMPONENT_CATEGORIES.map((cat) => {
          const isExpanded = expandedCategory === cat.type;
          const selectedOption = getSelectedOption(cat.type, selections[cat.type]);

          return (
            <div key={cat.type} className="border rounded-lg overflow-hidden">
              {/* Category header - clickable */}
              <button
                className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedCategory(isExpanded ? null : cat.type)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{cat.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{cat.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {selectedOption?.label || 'None'} 
                      {selectedOption && selectedOption.costPerShow > 0 && ` • $${selectedOption.costPerShow.toLocaleString()}/show`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedOption && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3 w-3",
                            i < (selectedOption.rating || 0) ? "fill-yellow-500 text-yellow-500" : "text-muted/50"
                          )}
                        />
                      ))}
                    </div>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {/* Options */}
              {isExpanded && (
                <div className="border-t px-2 py-2 space-y-1 bg-muted/20">
                  {cat.options.map((option) => {
                    const isLocked = bandFame < option.fameRequired;
                    const isSelected = selections[cat.type] === option.key;

                    return (
                      <button
                        key={option.key}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors",
                          isLocked && "opacity-40 cursor-not-allowed",
                          isSelected && "bg-primary/10 border border-primary/30",
                          !isLocked && !isSelected && "hover:bg-muted/50"
                        )}
                        disabled={isLocked}
                        onClick={() => !isLocked && updateSelection(cat.type, option.key)}
                      >
                        <span className="text-sm">{option.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{option.label}</span>
                            {option.costPerShow > 0 && (
                              <Badge variant="secondary" className="text-[9px] py-0">
                                ${option.costPerShow.toLocaleString()}
                              </Badge>
                            )}
                            {option.costPerShow === 0 && option.rating > 0 && (
                              <Badge variant="outline" className="text-[9px] py-0 text-green-500">Free</Badge>
                            )}
                            {isLocked && (
                              <Badge variant="outline" className="text-[9px] py-0">
                                <Lock className="h-2 w-2 mr-0.5" />
                                {option.fameRequired.toLocaleString()}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{option.description}</p>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-2.5 w-2.5",
                                i < option.rating ? "fill-yellow-500 text-yellow-500" : "text-muted/50"
                              )}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cost Summary */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Stage Cost</span>
            </div>
            <div className="text-right">
              <p className="text-lg font-black tabular-nums">${totalCost.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">
                {showCount} shows × ${costPerShow.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
