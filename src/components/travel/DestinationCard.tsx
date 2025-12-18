import { MapPin, Clock, DollarSign, Music, Plane, Train, Bus, Ship, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CityWithCoords, TravelOption } from "@/utils/dynamicTravel";

interface DestinationCardProps {
  city: CityWithCoords;
  distanceKm: number;
  options: TravelOption[];
  cheapestOption: TravelOption | null;
  fastestOption: TravelOption | null;
  onSelect: () => void;
}

const TRANSPORT_ICONS = {
  train: Train,
  plane: Plane,
  bus: Bus,
  ship: Ship,
} as const;

const TRANSPORT_COLORS = {
  bus: "text-green-500",
  train: "text-blue-500",
  plane: "text-purple-500",
  ship: "text-cyan-500",
} as const;

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDistance(km: number): string {
  if (km >= 1000) {
    return `${(km / 1000).toFixed(1)}k km`;
  }
  return `${km} km`;
}

export function DestinationCard({
  city,
  distanceKm,
  options,
  cheapestOption,
  fastestOption,
  onSelect,
}: DestinationCardProps) {
  const availableOptions = options.filter((o) => o.available);
  const unavailableOptions = options.filter((o) => !o.available);

  return (
    <Card className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group" onClick={onSelect}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* City Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold truncate">{city.name}</h4>
              {city.is_coastal && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-xs">🏖️</span>
                    </TooltipTrigger>
                    <TooltipContent>Coastal City</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{city.country}</p>
            
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                {formatDistance(distanceKm)}
              </Badge>
              {city.music_scene && (
                <Badge variant="secondary" className="text-xs">
                  <Music className="h-3 w-3 mr-1" />
                  {city.music_scene}%
                </Badge>
              )}
            </div>
          </div>

          {/* Transport Options Summary */}
          <div className="flex flex-col items-end gap-2">
            {/* Available transport icons */}
            <div className="flex gap-1">
              <TooltipProvider>
                {options.map((option) => {
                  const Icon = TRANSPORT_ICONS[option.icon as keyof typeof TRANSPORT_ICONS] || Plane;
                  const colorClass = TRANSPORT_COLORS[option.icon as keyof typeof TRANSPORT_COLORS] || "";
                  
                  return (
                    <Tooltip key={option.mode}>
                      <TooltipTrigger asChild>
                        <div
                          className={`p-1.5 rounded ${
                            option.available 
                              ? `bg-muted ${colorClass}` 
                              : "bg-muted/50 text-muted-foreground/30"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {option.available ? (
                          <span>
                            {option.mode.charAt(0).toUpperCase() + option.mode.slice(1)}: ${option.cost} • {formatDuration(option.durationHours)}
                          </span>
                        ) : (
                          <span className="text-destructive">
                            {option.unavailableReason}
                          </span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>

            {/* Best options */}
            {cheapestOption && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">From</div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">
                    ${cheapestOption.cost}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(cheapestOption.durationHours)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Info Row */}
        {availableOptions.length > 0 && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <div className="flex gap-3 text-xs text-muted-foreground">
              {cheapestOption && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Cheapest: ${cheapestOption.cost}
                </span>
              )}
              {fastestOption && fastestOption.mode !== cheapestOption?.mode && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Fastest: {formatDuration(fastestOption.durationHours)}
                </span>
              )}
            </div>
            <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
              View Options
            </Button>
          </div>
        )}

        {/* No available options warning */}
        {availableOptions.length === 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              No direct routes available
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
