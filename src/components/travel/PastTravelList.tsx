import { useQuery } from "@tanstack/react-query";
import { History, Plane, Train, Bus, Ship, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { format } from "date-fns";

interface PastTravelListProps {
  userId: string;
}

interface TravelHistoryEntry {
  id: string;
  from_city: { name: string; country: string } | null;
  to_city: { name: string; country: string };
  transport_type: string;
  cost_paid: number;
  travel_duration_hours: number;
  departure_time: string;
  arrival_time: string;
  status: string;
}

const TRANSPORT_ICONS = {
  train: Train,
  plane: Plane,
  bus: Bus,
  ship: Ship,
} as const;

export const PastTravelList = ({ userId }: PastTravelListProps) => {
  const { t } = useTranslation();

  const { data: travelHistory, isLoading } = useQuery({
    queryKey: ["past-travel", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_travel_history")
        .select(`
          id,
          from_city_id,
          to_city_id,
          transport_type,
          cost_paid,
          travel_duration_hours,
          departure_time,
          arrival_time,
          status
        `)
        .eq("user_id", userId)
        .in("status", ["completed", "cancelled"])
        .order("departure_time", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Collect all city IDs
      const cityIds = [...new Set([
        ...data.map(t => t.from_city_id),
        ...data.map(t => t.to_city_id)
      ])].filter(Boolean) as string[];

      // Fetch city data
      const { data: cities } = await supabase
        .from("cities")
        .select("id, name, country")
        .in("id", cityIds);
      
      const cityMap = new Map(cities?.map(c => [c.id, { name: c.name, country: c.country }]) || []);

      return data.map(t => ({
        id: t.id,
        from_city: t.from_city_id ? cityMap.get(t.from_city_id) || null : null,
        to_city: cityMap.get(t.to_city_id) || { name: "Unknown", country: "" },
        transport_type: t.transport_type,
        cost_paid: t.cost_paid,
        travel_duration_hours: t.travel_duration_hours,
        departure_time: t.departure_time,
        arrival_time: t.arrival_time,
        status: t.status,
      })) as TravelHistoryEntry[];
    },
    enabled: !!userId,
  });

  const getTransportIcon = (type: string) => {
    const Icon = TRANSPORT_ICONS[type.toLowerCase() as keyof typeof TRANSPORT_ICONS] || Train;
    return <Icon className="h-4 w-4" />;
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy h:mm a");
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
  };

  const getStatusBadge = (status: string) => {
    if (status === "cancelled") {
      return <Badge variant="destructive" className="text-xs">Cancelled</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Completed</Badge>;
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (!travelHistory || travelHistory.length === 0) {
    return (
      <Alert>
        <History className="h-4 w-4" />
        <AlertDescription>
          {t('travel.noHistory', "You haven't taken any trips yet. Book your first journey!")}
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate stats
  const completedTrips = travelHistory.filter(t => t.status === "completed");
  const totalSpent = completedTrips.reduce((sum, t) => sum + t.cost_paid, 0);
  const totalHours = completedTrips.reduce((sum, t) => sum + t.travel_duration_hours, 0);
  const citiesVisited = new Set(completedTrips.map(t => t.to_city.name)).size;

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{completedTrips.length}</div>
            <div className="text-sm text-muted-foreground">Trips Taken</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{citiesVisited}</div>
            <div className="text-sm text-muted-foreground">Cities Visited</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">${totalSpent.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Spent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{Math.round(totalHours)}h</div>
            <div className="text-sm text-muted-foreground">Time Traveling</div>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('schedule.past', 'Travel History')}
          </CardTitle>
          <CardDescription>
            Your complete travel log showing all past journeys
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Transport</TableHead>
                  <TableHead className="hidden md:table-cell">Duration</TableHead>
                  <TableHead className="hidden sm:table-cell">Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {travelHistory.map((trip) => (
                  <TableRow key={trip.id} className={trip.status === "cancelled" ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {trip.from_city && (
                          <span className="text-muted-foreground">{trip.from_city.name}</span>
                        )}
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span>{trip.to_city.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {getTransportIcon(trip.transport_type)}
                        <span className="capitalize hidden sm:inline">{trip.transport_type}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDuration(trip.travel_duration_hours)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {trip.status === "cancelled" ? (
                        <span className="line-through text-muted-foreground">
                          ${trip.cost_paid.toLocaleString()}
                        </span>
                      ) : (
                        `$${trip.cost_paid.toLocaleString()}`
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(trip.status)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDateTime(trip.departure_time)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
