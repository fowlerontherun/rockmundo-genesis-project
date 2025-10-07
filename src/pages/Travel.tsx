import { useState, useEffect } from "react";
import { MapPin, Clock, DollarSign, History } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useContext } from "react";
import { AuthContext } from "@/hooks/use-auth-context";

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

const Travel = () => {
  const { user } = useContext(AuthContext);
  const [currentCity, setCurrentCity] = useState<any>(null);
  const [travelHistory, setTravelHistory] = useState<TravelHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Travel Hub</h1>
        <p className="text-muted-foreground">
          Manage your location and plan your journey across the music world.
        </p>
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

      <Card>
        <CardHeader>
          <CardTitle>Travel Between Cities</CardTitle>
          <CardDescription>
            More cities are being added to the map. Soon you'll be able to travel between major music hubs worldwide!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Coming Soon</AlertTitle>
            <AlertDescription>
              Inter-city travel will be available once more cities are added to the system. For now, explore your current city and prepare for your future tours!
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default Travel;
