import { Clock, DollarSign, Sparkles, AlertCircle, Plane, Train, Bus, Ship, Check, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TravelOption } from "@/utils/dynamicTravel";

interface TransportComparisonProps {
  options: TravelOption[];
  selectedMode: string | null;
  onSelectMode: (mode: string) => void;
  userCash: number;
}

const TRANSPORT_ICONS = {
  train: Train,
  plane: Plane,
  bus: Bus,
  ship: Ship,
  private_jet: Crown,
} as const;

const TRANSPORT_LABELS = {
  bus: { name: "Bus", emoji: "🚌", description: "Budget-friendly, same country only" },
  train: { name: "Train", emoji: "🚄", description: "Fast and comfortable, regional routes" },
  plane: { name: "Plane", emoji: "✈️", description: "Fastest option for long distances" },
  ship: { name: "Ship", emoji: "🚢", description: "Scenic coastal routes" },
  private_jet: { name: "Private Jet", emoji: "🛩️", description: "Instant departure, any destination" },
} as const;

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h} hours`;
}

export function TransportComparison({
  options,
  selectedMode,
  onSelectMode,
  userCash,
}: TransportComparisonProps) {
  const availableOptions = options.filter((o) => o.available);
  const unavailableOptions = options.filter((o) => !o.available);

  // Find best options
  const cheapest = availableOptions.reduce(
    (min, o) => (o.cost < min.cost ? o : min),
    availableOptions[0]
  );
  const fastest = availableOptions.reduce(
    (min, o) => (o.durationHours < min.durationHours ? o : min),
    availableOptions[0]
  );
  const mostComfortable = availableOptions.reduce(
    (max, o) => (o.comfort > max.comfort ? o : max),
    availableOptions[0]
  );

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {availableOptions.length} transport options available
      </div>

      {/* Available Options */}
      <div className="space-y-3">
        {availableOptions.map((option) => {
          const Icon = TRANSPORT_ICONS[option.icon as keyof typeof TRANSPORT_ICONS] || Plane;
          const label = TRANSPORT_LABELS[option.mode as keyof typeof TRANSPORT_LABELS];
          const isSelected = selectedMode === option.mode;
          const canAfford = option.cost <= userCash;

          const isCheapest = option === cheapest && availableOptions.length > 1;
          const isFastest = option === fastest && availableOptions.length > 1;
          const isMostComfortable = option === mostComfortable && availableOptions.length > 1;
          const isPrivateJet = option.mode === 'private_jet';

          return (
            <Card
              key={option.mode}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "border-primary ring-2 ring-primary/20"
                  : canAfford
                  ? "hover:border-primary/50"
                  : "opacity-60"
              } ${isPrivateJet ? "bg-gradient-to-r from-amber-500/5 to-yellow-500/5 border-amber-500/30" : ""}`}
              onClick={() => canAfford && onSelectMode(option.mode)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Icon and Info */}
                  <div className="flex gap-3">
                    <div
                      className={`p-3 rounded-lg ${
                        isSelected ? "bg-primary text-primary-foreground" : 
                        isPrivateJet ? "bg-amber-500/20 text-amber-600" : "bg-muted"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-semibold ${isPrivateJet ? "text-amber-500" : ""}`}>{label?.name || option.mode}</h4>
                        {isPrivateJet && (
                          <Badge className="text-xs bg-gradient-to-r from-amber-500 to-yellow-500 text-black">
                            <Crown className="h-3 w-3 mr-0.5" />
                            VIP
                          </Badge>
                        )}
                        {isCheapest && (
                          <Badge variant="secondary" className="text-xs">
                            <DollarSign className="h-3 w-3 mr-0.5" />
                            Cheapest
                          </Badge>
                        )}
                        {isFastest && !isCheapest && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-0.5" />
                            Fastest
                          </Badge>
                        )}
                        {isMostComfortable && !isCheapest && !isFastest && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-0.5" />
                            Comfy
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {label?.description}
                      </p>
                      
                      {/* Comfort bar */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Comfort</span>
                        <Progress value={option.comfort} className="h-1.5 w-20" />
                        <span className="text-xs">{option.comfort}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Price and Duration */}
                  <div className="text-right">
                    <div
                      className={`text-xl font-bold ${
                        !canAfford ? "text-destructive" : ""
                      }`}
                    >
                      ${option.cost.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(option.durationHours)}
                    </div>
                    {!canAfford && (
                      <div className="text-xs text-destructive mt-1">
                        Insufficient funds
                      </div>
                    )}
                    {isSelected && canAfford && (
                      <Badge className="mt-2">
                        <Check className="h-3 w-3 mr-1" />
                        Selected
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unavailable Options */}
      {unavailableOptions.length > 0 && (
        <div className="pt-4 border-t">
          <div className="text-xs text-muted-foreground mb-2">
            Unavailable for this route:
          </div>
          <div className="flex flex-wrap gap-2">
            {unavailableOptions.map((option) => {
              const Icon = TRANSPORT_ICONS[option.icon as keyof typeof TRANSPORT_ICONS] || Plane;
              const label = TRANSPORT_LABELS[option.mode as keyof typeof TRANSPORT_LABELS];

              return (
                <Badge
                  key={option.mode}
                  variant="outline"
                  className="text-muted-foreground cursor-help"
                  title={option.unavailableReason}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {label?.name || option.mode}
                  <AlertCircle className="h-3 w-3 ml-1" />
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
