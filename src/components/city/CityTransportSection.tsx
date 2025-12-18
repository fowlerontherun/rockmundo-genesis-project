import { Train, Plane, Bus, Ship, Clock, DollarSign, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TransportRoute {
  id: string;
  transport_type: string;
  duration_hours: number;
  base_cost: number;
  comfort_rating: number;
  frequency: string | null;
  to_city: {
    name: string;
    country: string;
  } | null;
  from_city: {
    name: string;
    country: string;
  } | null;
}

interface CityTransportSectionProps {
  routes: TransportRoute[];
  cityName: string;
}

const TRANSPORT_ICONS: Record<string, typeof Train> = {
  rail: Train,
  train: Train,
  bus: Bus,
  air: Plane,
  flight: Plane,
  ship: Ship,
  ferry: Ship,
};

const TRANSPORT_COLORS: Record<string, string> = {
  rail: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  train: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  bus: "bg-green-500/10 text-green-600 border-green-500/30",
  air: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  flight: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  ship: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  ferry: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
};

const formatDuration = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const CityTransportSection = ({ routes, cityName }: CityTransportSectionProps) => {
  // Separate outbound and inbound routes
  const outboundRoutes = routes.filter(r => r.from_city === null || r.to_city !== null);
  const displayRoutes = outboundRoutes.length > 0 ? outboundRoutes : routes;

  // Group routes by transport type
  const groupedRoutes = displayRoutes.reduce((acc, route) => {
    const type = route.transport_type.toLowerCase();
    if (!acc[type]) acc[type] = [];
    acc[type].push(route);
    return acc;
  }, {} as Record<string, TransportRoute[]>);

  if (routes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Train className="h-5 w-5 text-primary" />
            Transport Connections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No direct transport routes available from {cityName}. Try checking nearby cities or use dynamic travel options.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Train className="h-5 w-5 text-primary" />
          Transport from {cityName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedRoutes).map(([type, typeRoutes]) => {
          const Icon = TRANSPORT_ICONS[type] || Train;
          const colorClass = TRANSPORT_COLORS[type] || "bg-muted text-muted-foreground border-border";
          
          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded border ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium capitalize">{type}</span>
                <Badge variant="secondary" className="text-xs">
                  {typeRoutes.length} route{typeRoutes.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              <div className="grid gap-2 sm:grid-cols-2">
                {typeRoutes.slice(0, 6).map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm hover:border-primary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {route.to_city?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {route.to_city?.country}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground ml-2">
                      <div className="flex items-center gap-1" title="Duration">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(route.duration_hours)}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Cost">
                        <DollarSign className="h-3 w-3" />
                        <span>{route.base_cost}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Comfort">
                        <Star className="h-3 w-3" />
                        <span>{route.comfort_rating}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {typeRoutes.length > 6 && (
                <p className="text-xs text-muted-foreground">
                  +{typeRoutes.length - 6} more destinations
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
