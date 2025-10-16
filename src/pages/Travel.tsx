import { useState, useEffect, useContext } from "react";
import { MapPin, Clock, DollarSign, History, Plane, Train, Bus, Ship } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/hooks/use-auth-context";
import { TravelBookingDialog } from "@/components/travel/TravelBookingDialog";
import { getAvailableRoutes } from "@/utils/travelSystem";

interface TravelHistoryEntry {
  id: string;
  from_city: { name: string; country: string } | null;
  to_city: { name: string; country: string };
  transport_type: string;
  cost_paid: number;
  travel_duration_hours: number;
  departure_time: string;
  arrival_time: string;
  created_at: string;
}

const TRANSPORT_ICONS = {
  train: Train,
  plane: Plane,
  bus: Bus,
  ship: Ship,
} as const;

const Travel = () => {
  const { user } = useContext(AuthContext);
  const [currentCity, setCurrentCity] = useState<any>(null);
  const [travelHistory, setTravelHistory] = useState<TravelHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState<any[]>([]);

  useEffect(() => {
    const loadTravelData = async () => {
      if (!user) return;

      try {
        // Load current city
        const { data: profile } = await supabase
          .from("profiles")
          .select("current_city_id, cities:current_city_id(*)")
          .eq("user_id", user.id)
          .single();

        if (profile?.cities) {
          setCurrentCity(profile.cities);
        }

        // Load travel history
        const { data: history } = await supabase
          .from("player_travel_history")
          .select(`
            *,
            from_city:from_city_id(name, country),
            to_city:to_city_id(name, country)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (history) {
          setTravelHistory(history as any);
        }
      } catch (error) {
        console.error("Error loading travel data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTravelData();
  }, [user]);

  useEffect(() => {
    if (currentCity?.id) {
      loadAvailableRoutes();
    }
  }, [currentCity]);

  const loadAvailableRoutes = async () => {
    if (!currentCity?.id) return;
    const routes = await getAvailableRoutes(currentCity.id);
    setAvailableRoutes(routes);
  };

  const getTransportIcon = (type: string) => {
    const Icon = TRANSPORT_ICONS[type.toLowerCase() as keyof typeof TRANSPORT_ICONS] || Train;
    return <Icon className="h-4 w-4" />;
  };

  const formatDateTime = (dateString: string) => {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Travel Hub</h1>
          <p className="text-muted-foreground">
            Manage your location and plan your journey across the music world.
          </p>
        </div>
        <Button onClick={() => setBookingDialogOpen(true)} size="lg">
          <Plane className="h-4 w-4 mr-2" />
          Book Travel
        </Button>
      </header>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Current Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentCity ? (
            <>
              <div>
                <h2 className="text-2xl font-bold">{currentCity.name}</h2>
                <p className="text-muted-foreground">{currentCity.country}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Music Scene: {currentCity.music_scene}%</Badge>
                <Badge variant="outline">Population: {(currentCity.population / 1_000_000).toFixed(1)}M</Badge>
                <Badge variant="outline">Cost of Living: {currentCity.cost_of_living}%</Badge>
              </div>
              <div className="flex gap-3">
                <Button asChild>
                  <Link to={`/cities/${currentCity.id}`}>Explore City</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/cities">View All Cities</Link>
                </Button>
              </div>
            </>
          ) : (
            <Alert>
              <MapPin className="h-4 w-4" />
              <AlertTitle>No Location Set</AlertTitle>
              <AlertDescription>
                You haven't set your current location yet. All players start in London by default.
                <Button variant="link" asChild className="pl-0">
                  <Link to="/cities">Explore cities to set your location</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {currentCity && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Available Routes from {currentCity.name}
            </CardTitle>
            <CardDescription>Choose your next destination</CardDescription>
          </CardHeader>
          <CardContent>
            {availableRoutes.length === 0 ? (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertTitle>No Routes Available</AlertTitle>
                <AlertDescription>
                  No direct routes are available from this city yet. Check back later as we expand our travel network!
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-3">
                {availableRoutes.map((route) => (
                  <Card key={route.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-primary/10 p-2">
                            {getTransportIcon(route.transport_type)}
                          </div>
                          <div>
                            <h4 className="font-semibold">
                              {route.to_city?.name}, {route.to_city?.country}
                            </h4>
                            <p className="text-sm text-muted-foreground capitalize">
                              via {route.transport_type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {route.duration_hours}h
                            </div>
                            <div className="flex items-center gap-1 text-sm font-semibold">
                              <DollarSign className="h-3 w-3" />
                              {route.base_cost}
                            </div>
                          </div>
                          <Button 
                            size="sm"
                            onClick={() => setBookingDialogOpen(true)}
                          >
                            Book
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {travelHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Travel History
            </CardTitle>
            <CardDescription>Your recent journeys across the music world</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Transport</TableHead>
                  <TableHead className="hidden sm:table-cell">Duration</TableHead>
                  <TableHead className="hidden sm:table-cell">Cost</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {travelHistory.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        {trip.from_city && (
                          <div className="text-xs text-muted-foreground">
                            From: {trip.from_city.name}
                          </div>
                        )}
                        <div>To: {trip.to_city.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{trip.transport_type}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {formatDuration(trip.travel_duration_hours)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      ${trip.cost_paid.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDateTime(trip.departure_time)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <TravelBookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        currentCityId={currentCity?.id || null}
        currentCityName={currentCity ? `${currentCity.name}, ${currentCity.country}` : undefined}
      />
    </div>
  );
};

export default Travel;
