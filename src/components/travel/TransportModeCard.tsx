import { Train, Plane, Bus, Ship, Clock, DollarSign, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TravelOption } from "@/utils/dynamicTravel";
import { cn } from "@/lib/utils";

interface TransportModeCardProps {
  option: TravelOption;
  selected: boolean;
  onSelect: () => void;
  canAfford: boolean;
}

const TRANSPORT_ICONS = {
  train: Train,
  plane: Plane,
  bus: Bus,
  ship: Ship,
} as const;

const TRANSPORT_COLORS = {
  train: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  plane: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  bus: "text-green-400 bg-green-500/10 border-green-500/20",
  ship: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
} as const;

export function TransportModeCard({ option, selected, onSelect, canAfford }: TransportModeCardProps) {
  const Icon = TRANSPORT_ICONS[option.icon as keyof typeof TRANSPORT_ICONS] || Train;
  const colorClass = TRANSPORT_COLORS[option.icon as keyof typeof TRANSPORT_COLORS] || TRANSPORT_COLORS.train;

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:scale-[1.02]",
        selected ? "ring-2 ring-primary border-primary" : "hover:border-primary/50",
        !canAfford && "opacity-50"
      )}
      onClick={canAfford ? onSelect : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={cn("p-3 rounded-xl border", colorClass)}>
            <Icon className="h-6 w-6" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold capitalize">{option.mode}</h4>
              {selected && (
                <Badge variant="default" className="text-xs">Selected</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {option.distanceKm.toLocaleString()} km
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" />
              </div>
              <p className={cn("font-semibold", !canAfford && "text-destructive")}>
                ${option.cost}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Clock className="h-3 w-3" />
              </div>
              <p className="font-semibold">{formatDuration(option.durationHours)}</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Star className="h-3 w-3" />
              </div>
              <p className="font-semibold">{option.comfort}%</p>
            </div>
          </div>
        </div>
        
        {!canAfford && (
          <p className="text-xs text-destructive mt-2">Insufficient funds</p>
        )}
      </CardContent>
    </Card>
  );
}
