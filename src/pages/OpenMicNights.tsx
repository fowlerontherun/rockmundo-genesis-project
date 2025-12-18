import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { 
  useOpenMicVenues, 
  useOpenMicPerformances, 
  useSignUpForOpenMic,
  getDayName,
  getNextOpenMicDate
} from "@/hooks/useOpenMicNights";
import { OpenMicSongSelector } from "@/components/open-mic/OpenMicSongSelector";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Mic, 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  Music,
  Star,
  AlertCircle,
  Play,
  X,
  Info
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function OpenMicNights() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCity } = useGameData();
  const { data: primaryBand } = usePrimaryBand();
  const userBand = primaryBand?.bands ? { id: primaryBand.band_id, ...primaryBand.bands } : null;
  const [selectedCityId, setSelectedCityId] = useState<string>(currentCity?.id || 'all');
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const { data: venues = [], isLoading: venuesLoading } = useOpenMicVenues(
    selectedCityId === 'all' ? undefined : selectedCityId
  );
  const { data: myPerformances = [] } = useOpenMicPerformances(user?.id);
  const signUp = useSignUpForOpenMic();

  const { data: cities = [] } = useQuery({
    queryKey: ['cities-for-open-mic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, country')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const upcomingPerformances = myPerformances.filter(
    (p) => p.status === 'scheduled' || p.status === 'in_progress'
  );
  const pastPerformances = myPerformances.filter(
    (p) => p.status === 'completed' || p.status === 'cancelled'
  );

  const handleSignUp = (venueId: string) => {
    if (!userBand) return;
    setSelectedVenue(venueId);
    setSelectorOpen(true);
  };

  const handleSongSelection = (song1Id: string, song2Id: string) => {
    if (!selectedVenue || !userBand) return;
    
    const venue = venues.find((v) => v.id === selectedVenue);
    if (!venue) return;

    const scheduledDate = getNextOpenMicDate(venue.day_of_week);
    
    signUp.mutate({
      venueId: selectedVenue,
      bandId: userBand.id,
      song1Id: song1Id,
      song2Id: song2Id,
      scheduledDate,
    });
  };

  const canPerform = (performance: typeof myPerformances[0]) => {
    const scheduledDate = new Date(performance.scheduled_date);
    return isToday(scheduledDate) || isPast(scheduledDate);
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Mic className="h-8 w-8 text-primary" />
            Open Mic Nights
          </h1>
          <p className="text-muted-foreground mt-1">
            Showcase your talent, gain fans and fame - every city, every week
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> Sign up to play 2 songs at any open mic venue. 
          You won't earn money, but you'll gain fame and fans based on your performance!
        </AlertDescription>
      </Alert>

      {!userBand && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to be in a band to perform at open mic nights.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList>
          <TabsTrigger value="browse">Browse Venues</TabsTrigger>
          <TabsTrigger value="upcoming">
            My Upcoming ({upcomingPerformances.length})
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Browse Venues Tab */}
        <TabsContent value="browse" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={selectedCityId} onValueChange={setSelectedCityId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Filter by city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}, {city.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => {
              const nextDate = getNextOpenMicDate(venue.day_of_week);
              const isCurrentCity = venue.city_id === currentCity?.id;
              const hasUpcoming = upcomingPerformances.some(
                (p) => p.venue_id === venue.id
              );

              return (
                <Card key={venue.id} className={isCurrentCity ? 'border-primary/50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{venue.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {venue.city?.name}, {venue.city?.country}
                        </CardDescription>
                      </div>
                      {isCurrentCity && (
                        <Badge variant="secondary" className="text-xs">
                          Your City
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Every {getDayName(venue.day_of_week)}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        8:00 PM
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Capacity: {venue.capacity}
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">
                        Next: {format(nextDate, 'MMM d, yyyy')}
                      </p>
                      
                      {hasUpcoming ? (
                        <Badge variant="outline" className="w-full justify-center">
                          Already Signed Up
                        </Badge>
                      ) : (
                        <Button
                          className="w-full"
                          size="sm"
                          disabled={!userBand || !isCurrentCity}
                          onClick={() => handleSignUp(venue.id)}
                        >
                          <Music className="h-4 w-4 mr-2" />
                          Sign Up to Play
                        </Button>
                      )}
                      
                      {!isCurrentCity && userBand && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          Travel to this city to sign up
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Upcoming Performances Tab */}
        <TabsContent value="upcoming" className="space-y-4">
          {upcomingPerformances.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming open mic performances</p>
                <p className="text-sm">Sign up at a venue to get started!</p>
              </CardContent>
            </Card>
          ) : (
            upcomingPerformances.map((perf) => {
              const scheduledDate = new Date(perf.scheduled_date);
              const canStart = canPerform(perf);
              
              return (
                <Card key={perf.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{perf.venue?.name}</h3>
                          <Badge variant={perf.status === 'in_progress' ? 'default' : 'secondary'}>
                            {perf.status === 'in_progress' ? 'Live Now!' : 'Scheduled'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {perf.venue?.city?.name} • {format(scheduledDate, 'EEEE, MMM d @ h:mm a')}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Music className="h-4 w-4" />
                          <span>{perf.song_1?.title}</span>
                          <span>•</span>
                          <span>{perf.song_2?.title}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {perf.status === 'in_progress' ? (
                          <Button onClick={() => navigate(`/open-mic/perform/${perf.id}`)}>
                            <Play className="h-4 w-4 mr-2" />
                            Continue
                          </Button>
                        ) : canStart ? (
                          <Button onClick={() => navigate(`/open-mic/perform/${perf.id}`)}>
                            <Play className="h-4 w-4 mr-2" />
                            Start Performance
                          </Button>
                        ) : (
                          <Button variant="outline" disabled>
                            <Clock className="h-4 w-4 mr-2" />
                            Not Yet
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {pastPerformances.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No past performances yet</p>
              </CardContent>
            </Card>
          ) : (
            pastPerformances.map((perf) => (
              <Card key={perf.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{perf.venue?.name}</h3>
                        <Badge variant={perf.status === 'completed' ? 'default' : 'destructive'}>
                          {perf.status === 'completed' ? 'Completed' : 'Cancelled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {perf.venue?.city?.name} • {format(new Date(perf.scheduled_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    
                    {perf.status === 'completed' && (
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {perf.overall_rating?.toFixed(0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          +{perf.fame_gained} Fame • +{perf.fans_gained} Fans
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Song Selector Modal */}
      {userBand && (
        <OpenMicSongSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          bandId={userBand.id}
          onConfirm={handleSongSelection}
        />
      )}
    </div>
  );
}
