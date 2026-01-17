import { useState, useEffect, useContext } from "react";
import { MapPin, Plane, Train, Bus, Ship, Globe, ArrowRight, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/hooks/use-auth-context";
import { useTranslation } from "@/hooks/useTranslation";
import { TravelDestinationBrowser } from "@/components/travel/TravelDestinationBrowser";
import { TransportComparison } from "@/components/travel/TransportComparison";
import { DepartureTimePicker } from "@/components/travel/DepartureTimePicker";
import { UpcomingTravelList } from "@/components/travel/UpcomingTravelList";
import { PastTravelList } from "@/components/travel/PastTravelList";
import { bookTravel } from "@/utils/travelSystem";
import { CityWithCoords, TravelOption } from "@/utils/dynamicTravel";
import { getNextAvailableDeparture, isValidDeparture, formatHourToTime, calculateArrivalTime } from "@/utils/transportSchedules";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface SelectedDestination {
  city: CityWithCoords;
  distanceKm: number;
  options: TravelOption[];
  cheapestOption: TravelOption | null;
  fastestOption: TravelOption | null;
}

const TRANSPORT_ICONS = {
  train: Train,
  plane: Plane,
  bus: Bus,
  ship: Ship,
} as const;

const Travel = () => {
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentCity, setCurrentCity] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState<SelectedDestination | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  
  // Departure scheduling state
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [departureHour, setDepartureHour] = useState<number | null>(null);

  useEffect(() => {
    const loadTravelData = async () => {
      if (!user) return;

      try {
        // Load profile and current city
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*, cities:current_city_id(*)")
          .eq("user_id", user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
          if (profileData.cities) {
            setCurrentCity(profileData.cities);
          }
        }
      } catch (error) {
        console.error("Error loading travel data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTravelData();
  }, [user]);

  const handleSelectDestination = (destination: SelectedDestination) => {
    setSelectedDestination(destination);
    // Reset mode and departure selection
    setSelectedMode(null);
    setDepartureDate(null);
    setDepartureHour(null);
    
    // Auto-select cheapest option
    if (destination.cheapestOption) {
      setSelectedMode(destination.cheapestOption.mode);
    }
  };

  // Auto-set next available departure when mode changes
  useEffect(() => {
    if (selectedMode && !departureDate) {
      const next = getNextAvailableDeparture(selectedMode);
      setDepartureDate(next.date);
      setDepartureHour(next.hour);
    }
  }, [selectedMode]);

  const handleBookTravel = async () => {
    if (!user || !selectedDestination || !selectedMode || !currentCity || !departureDate || departureHour === null) return;

    const selectedOption = selectedDestination.options.find(o => o.mode === selectedMode);
    if (!selectedOption) return;

    // Validate departure
    if (!isValidDeparture(departureDate, departureHour, selectedMode)) {
      toast.error("Please select a valid departure time");
      return;
    }

    // Create scheduled departure time
    const scheduledDeparture = new Date(departureDate);
    scheduledDeparture.setHours(departureHour, 0, 0, 0);

    setIsBooking(true);
    try {
      await bookTravel({
        userId: user.id,
        fromCityId: currentCity.id,
        toCityId: selectedDestination.city.id,
        routeId: `dynamic-${currentCity.id}-${selectedDestination.city.id}`,
        transportType: selectedMode,
        cost: selectedOption.cost,
        durationHours: selectedOption.durationHours,
        comfortRating: selectedOption.comfort,
        scheduledDepartureTime: scheduledDeparture.toISOString(),
      });

      const arrivalTime = calculateArrivalTime(departureDate, departureHour, selectedOption.durationHours);
      toast.success(
        `Travel booked! Departing ${formatHourToTime(departureHour)}, arriving in ${selectedDestination.city.name} at ${format(arrivalTime, "h:mm a")}`
      );
      
      // Refresh profile data and travel queries
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-travel"] });
      
      // Close dialog
      setSelectedDestination(null);
      setSelectedMode(null);
      setDepartureDate(null);
      setDepartureHour(null);

      // Reload page data
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Failed to book travel");
    } finally {
      setIsBooking(false);
    }
  };

  // Get selected option for validation
  const selectedOption = selectedDestination?.options.find(o => o.mode === selectedMode);
  const hasValidDeparture = selectedMode && departureDate && departureHour !== null &&
    isValidDeparture(departureDate, departureHour, selectedMode);

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
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="h-8 w-8 text-primary" />
          {t('travel.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('travel.destination', 'Explore the world and travel to new cities for gigs, recording, and more.')}
        </p>
      </header>

      {/* Current Location Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            {t('travel.currentLocation')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentCity ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold">{currentCity.name}</h2>
                <p className="text-muted-foreground">{currentCity.country}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">🎵 {t('nav.music', 'Music Scene')}: {currentCity.music_scene}%</Badge>
                  {currentCity.is_coastal && <Badge variant="outline">🏖️ {t('travel.ship', 'Coastal')}</Badge>}
                  {currentCity.has_train_network && <Badge variant="outline">🚄 {t('travel.train', 'Rail Hub')}</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link to={`/cities/${currentCity.id}`}>{t('common.viewDetails', 'Explore City')}</Link>
                </Button>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  💰 ${(profile?.cash || 0).toLocaleString()}
                </Badge>
              </div>
            </div>
          ) : (
            <Alert>
              <MapPin className="h-4 w-4" />
              <AlertTitle>{t('common.noData', 'No Location Set')}</AlertTitle>
              <AlertDescription>
                {t('travel.inTransit', "You haven't set your current location yet. All players start in London by default.")}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="book" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="book" className="flex items-center gap-2">
            <Plane className="h-4 w-4" />
            <span className="hidden sm:inline">Book Travel</span>
            <span className="sm:hidden">Book</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">My Travel Plans</span>
            <span className="sm:hidden">Plans</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Past Travel</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Book Travel Tab */}
        <TabsContent value="book" className="space-y-6">
          {currentCity ? (
            <TravelDestinationBrowser
              currentCityId={currentCity.id}
              currentCityName={currentCity.name}
              onSelectDestination={handleSelectDestination}
            />
          ) : (
            <Alert>
              <MapPin className="h-4 w-4" />
              <AlertDescription>
                Set your current location to browse travel destinations.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* My Travel Plans Tab */}
        <TabsContent value="upcoming" className="space-y-6">
          {user && <UpcomingTravelList userId={user.id} />}
        </TabsContent>

        {/* Past Travel Tab */}
        <TabsContent value="history" className="space-y-6">
          {user && <PastTravelList userId={user.id} />}
        </TabsContent>
      </Tabs>

      {/* Booking Dialog */}
      <Dialog open={!!selectedDestination} onOpenChange={(open) => !open && setSelectedDestination(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              {t('travel.travelTo', 'Travel to')} {selectedDestination?.city.name}
            </DialogTitle>
            <DialogDescription>
              {selectedDestination?.city.country} • {selectedDestination?.distanceKm.toLocaleString()} km
            </DialogDescription>
          </DialogHeader>

          {selectedDestination && (
            <div className="space-y-4">
              {/* City Info */}
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{currentCity?.name}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{selectedDestination.city.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {selectedDestination.city.music_scene}% {t('travel.musicScene')}
                  </div>
                </div>
              </div>

              {/* Transport Options */}
              <TransportComparison
                options={selectedDestination.options}
                selectedMode={selectedMode}
                onSelectMode={(mode) => {
                  setSelectedMode(mode);
                  // Reset departure when mode changes
                  setDepartureDate(null);
                  setDepartureHour(null);
                }}
                userCash={profile?.cash || 0}
              />

              {/* Departure Time Picker - only show when mode is selected */}
              {selectedMode && selectedOption && (
                <DepartureTimePicker
                  transportType={selectedMode}
                  durationHours={selectedOption.durationHours}
                  selectedDate={departureDate}
                  selectedHour={departureHour}
                  onDateChange={setDepartureDate}
                  onHourChange={setDepartureHour}
                />
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelectedDestination(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleBookTravel}
              disabled={
                !selectedMode || 
                isBooking || 
                !hasValidDeparture ||
                !selectedOption?.available
              }
            >
              {isBooking ? t('travel.booking') : t('travel.bookTravel')}
              {selectedOption && (
                <span className="ml-2">
                  (${selectedOption.cost})
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Travel;
