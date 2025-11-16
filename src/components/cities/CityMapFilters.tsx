import { Layers3, MapPin, CalendarCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CityMapLayerId } from "./CityMap";

const toTitleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

interface CityMapFiltersProps {
  activeLayers: CityMapLayerId[];
  onLayerToggle: (layer: CityMapLayerId, value: boolean) => void;
  selectedVenueType: string | null;
  onVenueTypeChange: (value: string | null) => void;
  availableVenueTypes: string[];
  showOnlyActiveEvents: boolean;
  onShowOnlyActiveEventsChange: (value: boolean) => void;
  stats: {
    venues: number;
    events: number;
    activeEvents: number;
  };
}

export const CityMapFilters = ({
  activeLayers,
  onLayerToggle,
  selectedVenueType,
  onVenueTypeChange,
  availableVenueTypes,
  showOnlyActiveEvents,
  onShowOnlyActiveEventsChange,
  stats,
}: CityMapFiltersProps) => {
  return (
    <div className="space-y-5 rounded-xl border border-border/60 bg-background/70 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Layers3 className="h-4 w-4 text-primary" />
        Map filters
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-background/60 p-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Venues
            </div>
            <p className="text-xs text-muted-foreground">
              Highlight booked venues, arenas, and grassroots spaces.
            </p>
          </div>
          <Switch
            checked={activeLayers.includes("venues")}
            onCheckedChange={(value) => onLayerToggle("venues", value)}
            aria-label="Toggle venues layer"
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-background/60 p-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Events
            </div>
            <p className="text-xs text-muted-foreground">
              Overlay festivals, seasonal boosts, and limited-time opportunities.
            </p>
          </div>
          <Switch
            checked={activeLayers.includes("events")}
            onCheckedChange={(value) => onLayerToggle("events", value)}
            aria-label="Toggle events layer"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Venue type
        </Label>
        <Select
          value={selectedVenueType ?? "all"}
          onValueChange={(value) => onVenueTypeChange(value === "all" ? null : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All venue types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All venue types</SelectItem>
            {availableVenueTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {toTitleCase(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-background/60 p-3">
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">Active events only</Label>
          <p className="text-xs text-muted-foreground">
            Hide expired events to focus on current bonuses and boosts.
          </p>
        </div>
        <Switch
          checked={showOnlyActiveEvents}
          onCheckedChange={onShowOnlyActiveEventsChange}
          aria-label="Toggle active events"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="space-y-1 rounded-md border border-border/50 bg-background/60 p-2">
          <div className="text-sm font-semibold text-foreground">{stats.venues}</div>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            Venues
          </Badge>
        </div>
        <div className="space-y-1 rounded-md border border-border/50 bg-background/60 p-2">
          <div className="text-sm font-semibold text-foreground">{stats.events}</div>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            Events
          </Badge>
        </div>
        <div className="space-y-1 rounded-md border border-border/50 bg-background/60 p-2">
          <div className="text-sm font-semibold text-foreground">{stats.activeEvents}</div>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            Active
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default CityMapFilters;
