import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Lock, Check, Star, AlertTriangle, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  VEHICLE_TIERS, VehicleTier, VehicleTierConfig,
  getEquipmentTruckCost, type HaulRequirement
} from '@/lib/tourVehicles';

interface TourVehiclePickerProps {
  value: VehicleTier;
  onChange: (tier: VehicleTier) => void;
  bandFame: number;
  tourDurationDays: number;
  stageHaulRequirement?: HaulRequirement;
}

const SPEED_LABELS = { slow: 'Slow', medium: 'Medium', fast: 'Fast', fastest: 'Fastest' };
const SPEED_COLORS = { slow: 'text-destructive', medium: 'text-yellow-500', fast: 'text-green-500', fastest: 'text-primary' };

export function TourVehiclePicker({ value, onChange, bandFame, tourDurationDays, stageHaulRequirement = 'minimal' }: TourVehiclePickerProps) {
  const selectedVehicle = VEHICLE_TIERS.find(v => v.key === value) || VEHICLE_TIERS[0];
  const totalCost = selectedVehicle.dailyCost * tourDurationDays;
  const extraTruckCost = getEquipmentTruckCost(stageHaulRequirement, selectedVehicle.gearHaulCapacity);
  const extraTruckTotal = extraTruckCost * tourDurationDays;

  return (
    <div className="space-y-4">
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <Truck className="h-4 w-4" />
          Tour Transport
        </Label>
        <p className="text-sm text-muted-foreground">
          Start in a rusty van, work your way to a private jet
        </p>
      </div>

      <RadioGroup value={value} onValueChange={(v) => onChange(v as VehicleTier)}>
        <div className="grid gap-2">
          {VEHICLE_TIERS.map((vehicle) => {
            const isLocked = bandFame < vehicle.fameRequired;
            const isSelected = value === vehicle.key;
            const vehicleTruckCost = getEquipmentTruckCost(stageHaulRequirement, vehicle.gearHaulCapacity);

            return (
              <div
                key={vehicle.key}
                className={cn(
                  "relative flex items-start space-x-3 p-3 border rounded-lg transition-colors",
                  isLocked && "opacity-40 cursor-not-allowed",
                  isSelected && "border-primary bg-primary/5",
                  !isLocked && !isSelected && "hover:border-muted-foreground/50"
                )}
              >
                <RadioGroupItem value={vehicle.key} disabled={isLocked} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{vehicle.icon}</span>
                    <span className="font-semibold text-sm">{vehicle.label}</span>
                    {vehicle.dailyCost > 0 ? (
                      <Badge variant="secondary" className="text-[10px]">
                        ${vehicle.dailyCost.toLocaleString()}/day
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">Free</Badge>
                    )}
                    {isLocked && (
                      <Badge variant="outline" className="text-[10px]">
                        <Lock className="h-2.5 w-2.5 mr-0.5" />
                        {vehicle.fameRequired.toLocaleString()} fame
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{vehicle.description}</p>
                  
                  {/* Stats row */}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {/* Comfort stars */}
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3 w-3",
                            i < vehicle.comfort ? "fill-yellow-500 text-yellow-500" : "text-muted"
                          )}
                        />
                      ))}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      👥 {vehicle.capacity}
                    </Badge>
                    <span className={cn("text-[10px] font-medium", SPEED_COLORS[vehicle.speed])}>
                      {SPEED_LABELS[vehicle.speed]}
                    </span>
                    {vehicle.breakdownChance > 0.05 && (
                      <span className="text-[10px] text-destructive flex items-center gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Breakdowns
                      </span>
                    )}
                    {vehicleTruckCost > 0 && (
                      <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                        <Truck className="h-2.5 w-2.5" />
                        +${vehicleTruckCost}/day truck
                      </span>
                    )}
                  </div>

                  {/* Perks */}
                  {isSelected && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {vehicle.perks.map((perk) => (
                        <Badge key={perk} variant="outline" className="text-[9px] py-0">
                          {perk}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {isSelected && !isLocked && (
                  <Check className="h-5 w-5 text-primary shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </RadioGroup>

      {/* Cost summary */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm">Vehicle Cost ({tourDurationDays} days)</span>
          <span className="text-sm font-bold tabular-nums">${totalCost.toLocaleString()}</span>
        </div>
        {extraTruckTotal > 0 && (
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-xs flex items-center gap-1">
              <Truck className="h-3 w-3" /> Equipment truck rental
            </span>
            <span className="text-xs font-bold tabular-nums">+${extraTruckTotal.toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-1 mt-1">
          <span className="text-sm font-semibold">Total Transport</span>
          <span className="text-lg font-black tabular-nums">${(totalCost + extraTruckTotal).toLocaleString()}</span>
        </div>
        {selectedVehicle.moralBoost !== 0 && (
          <p className="text-[10px] text-muted-foreground">
            {selectedVehicle.moralBoost > 0 ? '🟢' : '🔴'} Morale: {selectedVehicle.moralBoost > 0 ? '+' : ''}{selectedVehicle.moralBoost}% band chemistry during tour
          </p>
        )}
      </div>
    </div>
  );
}
