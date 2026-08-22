import { useState, useEffect, useContext } from "react";
import { MapPin, Plane, Globe, ArrowRight, Calendar } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useTranslation } from "@/hooks/useTranslation";
import { TravelDestinationBrowser } from "@/components/travel/TravelDestinationBrowser";
import { TransportComparison } from "@/components/travel/TransportComparison";
import { DepartureTimePicker } from "@/components/travel/DepartureTimePicker";
import { UpcomingTravelList } from "@/components/travel/UpcomingTravelList";
import { PastTravelList } from "@/components/travel/PastTravelList";
import { TravelTimelineLog } from "@/components/travel/TravelTimelineLog";
import { TravelNotificationPreferences } from "@/components/travel/TravelNotificationPreferences";
import { bookTravel, getTravelTaxForDeparture } from "@/utils/travelSystem";
import {
  CityWithCoords,
  TravelOption,
  fetchCityWithCoords,
  calculateDistance,
  getAvailableModes,
} from "@/utils/dynamicTravel";
import { applyCityDevelopmentToTravelQuotes } from "@/utils/cityDevelopmentTravel";
import { getNextAvailableDeparture, isValidDeparture, formatHourToTime } from "@/utils/transportSchedules";
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

const Travel = () => {
  const { user } = useContext(AuthContext);
  const { profileId } = useActiveProfile();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentCity, setCurrentCity] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState<SelectedDestination | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [travelTaxPreview, setTravelTaxPreview] = useState(0);
  const [travelTaxLoading, setTravelTaxLoading] = useState(false);

  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [departureHour, setDepartureHour] = useState<number | null>(null);

  useEffect(() => {
    const loadTravelData = async () => {
      if (!profileId) return;

      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*, cities:current_city_id(*)")
          .eq("id", profileId)
          .single();

        if (profileData) {
          setProfile(profileData);
          if (profileData.cities) setCurrentCity(profileData.cities);
        }
      } catch (error) {
        console.error("Error loading travel data:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadTravelData();
  }, [profileId]);

  const handleSelectDestination = (destination: SelectedDestination) => {
    setSelectedDestination(destination);
    setSelectedMode(null);
    setDepartureDate(null);
    setDepartureHour(null);
    if (destination.cheapestOption) setSelectedMode(destination.cheapestOption.mode);
  };

  useEffect(() => {
    if (selectedMode && !departureDate) {
      const next = getNextAvailableDeparture(selectedMode);
      setDepartureDate(next.date);
      setDepartureHour(next.hour);
    }
  }, [selectedMode, departureDate]);

  useEffect(() => {
    if (!currentCity?.id || !selectedMode || !departureDate || departureHour === null) {
      setTravelTaxPreview(0);
      return;
    }

    const departure = new Date(departureDate);
    if (selectedMode.toLowerCase() !== "private_jet") departure.setHours(departureHour, 0, 0, 0);

    let cancelled = false;
    setTravelTaxLoading(true);
    void getTravelTaxForDeparture(currentCity.id, departure.toISOString())
      .then((tax) => {
        if (!cancelled) setTravelTaxPreview(tax);
      })
      .finally(() => {
        if (!cancelled) setTravelTaxLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentCity?.id, departureDate, departureHour, selectedMode]);

  useEffect(() => {
    const destId = searchParams.get("destination");
    if (!destId || !currentCity || selectedDestination) return;
    if (destId === currentCity.id) {
      toast.info("You're already in this city.");
      searchParams.delete("destination");
      setSearchParams(searchParams, { replace: true });
      return;
    }

    void (async () => {
      const dest = await fetchCityWithCoords(destId);
      if (!dest || dest.latitude == null || dest.longitude == null || currentCity.latitude == null || currentCity.longitude == null) {
        toast.error("Destination not found");
        return;
      }

      const distanceKm = calculateDistance(
        currentCity.latitude,
        currentCity.longitude,
        dest.latitude,
        dest.longitude,
      );
      const baseOptions = getAvailableModes(distanceKm, currentCity, dest);
      const [adjusted] = await applyCityDevelopmentToTravelQuotes(currentCity.id, [{
        city: dest,
        distanceKm,
        options: baseOptions,
        cheapestOption: null,
        fastestOption: null,
      }]);
      const options = adjusted?.options ?? baseOptions;
      const available = options.filter((option) => option.available);
      const cheapest = available.length ? available.reduce((best, option) => option.cost < best.cost ? option : best) : null;
      const fastest = available.length ? available.reduce((best, option) => option.durationHours < best.durationHours ? option : best) : null;
      handleSelectDestination({ city: dest, distanceKm, options, cheapestOption: cheapest, fastestOption: fastest });
      searchParams.delete("destination");
      setSearchParams(searchParams, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, currentCity]);

  const handleBookTravel = async () => {
    if (!user || !selectedDestination || !selectedMode || !currentCity || !departureDate || departureHour === null || !profileId) return;

    const selectedOption = selectedDestination.options.find((option) => option.mode === selectedMode);
    if (!selectedOption) return;
    if (!isValidDeparture(departureDate, departureHour, selectedMode)) {
      toast.error("Please select a valid departure time");
      return;
    }

    const scheduledDeparture = new Date(departureDate);
    if (selectedMode.toLowerCase() !== "private_jet") scheduledDeparture.setHours(departureHour, 0, 0, 0);

    setIsBooking(true);
    try {
      const result = await bookTravel({
        profileId,
        fromCityId: currentCity.id,
        toCityId: selectedDestination.city.id,
        routeId: `dynamic-${currentCity.id}-${selectedDestination.city.id}`,
        transportType: selectedMode,
        cost: selectedOption.cost,
        durationHours: selectedOption.durationHours,
        comfortRating: selectedOption.comfort,
        scheduledDepartureTime: scheduledDeparture.toISOString(),
      });

      const arrival = new Date(result.arrivalTime);
      toast.success(`Travel booked to ${result.toCityName}`, {
        description: `${formatHourToTime(departureHour)} departure · arrives ${format(arrival, "h:mm a")} · fare $${result.fare.toLocaleString()} + $${result.travelTax.toLocaleString()} ${result.fromCityName} travel tax = $${result.totalCost.toLocaleString()}`,
      });

      const { data: refreshedProfile } = await supabase
        .from("profiles")
        .select("cash,is_traveling,travel_arrives_at")
        .eq("id", profileId)
        .maybeSingle();
      if (refreshedProfile) setProfile((current: any) => ({ ...current, ...refreshedProfile }));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["upcoming-travel"] }),
        queryClient.invalidateQueries({ queryKey: ["past-travel"] }),
        queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
      ]);

      setSelectedDestination(null);
      setSelectedMode(null);
      setDepartureDate(null);
      setDepartureHour(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to book travel");
    } finally {
      setIsBooking(false);
    }
  };

  const selectedOption = selectedDestination?.options.find((option) => option.mode === selectedMode);
  const hasValidDeparture = selectedMode && departureDate && departureHour !== null &&
    isValidDeparture(departureDate, departureHour, selectedMode);
  const previewTotal = (selectedOption?.cost ?? 0) + travelTaxPreview;

  if (loading) {
    return (
      <FMPageScaffold title={t("travel.title")} icon={Globe} backTo="/hub/world-social" backLabel="Back to World & Social">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold
      title={t("travel.title")}
      subtitle={t("travel.destination", "Explore the world and travel to new cities for gigs, recording, and more.")}
      icon={Globe}
      backTo="/hub/world-social"
      backLabel="Back to World & Social"
    >
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            {t("travel.currentLocation")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentCity ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold">{currentCity.name}</h2>
                <p className="text-muted-foreground">{currentCity.country}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">🎵 {t("nav.music", "Music Scene")}: {currentCity.music_scene}%</Badge>
                  {currentCity.is_coastal && <Badge variant="outline">🏖️ {t("travel.ship", "Coastal")}</Badge>}
                  {currentCity.has_train_network && <Badge variant="outline">🚄 {t("travel.train", "Rail Hub")}</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link to={`/cities/${currentCity.id}`}>{t("common.viewDetails", "Explore City")}</Link>
                </Button>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  💰 ${(profile?.cash || 0).toLocaleString()}
                </Badge>
              </div>
            </div>
          ) : (
            <Alert>
              <MapPin className="h-4 w-4" />
              <AlertTitle>{t("common.noData", "No Location Set")}</AlertTitle>
              <AlertDescription>
                {t("travel.inTransit", "You haven't set your current location yet. All players start in London by default.")}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
              <AlertDescription>Set your current location to browse travel destinations.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-6">
          {user && <UpcomingTravelList userId={user.id} />}
          <TravelNotificationPreferences />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {profileId && <PastTravelList profileId={profileId} />}
          {profileId && <TravelTimelineLog profileId={profileId} includeAllMembers={false} />}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedDestination} onOpenChange={(open) => !open && setSelectedDestination(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              {t("travel.travelTo", "Travel to")} {selectedDestination?.city.name}
            </DialogTitle>
            <DialogDescription>
              {selectedDestination?.city.country} • {selectedDestination?.distanceKm.toLocaleString()} km
            </DialogDescription>
          </DialogHeader>

          {selectedDestination && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{currentCity?.name}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{selectedDestination.city.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {selectedDestination.city.music_scene}% {t("travel.musicScene")}
                  </div>
                </div>
              </div>

              <TransportComparison
                options={selectedDestination.options}
                selectedMode={selectedMode}
                onSelectMode={(mode) => {
                  setSelectedMode(mode);
                  setDepartureDate(null);
                  setDepartureHour(null);
                }}
                userCash={profile?.cash || 0}
              />

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

              {selectedOption && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <div className="flex items-center justify-between"><span>Transport fare</span><span className="font-medium">${selectedOption.cost.toLocaleString()}</span></div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>{currentCity?.name ?? "Departure city"} travel tax</span>
                    <span className="font-medium">{travelTaxLoading ? "Checking…" : `$${travelTaxPreview.toLocaleString()}`}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-base font-semibold"><span>Estimated total</span><span>${previewTotal.toLocaleString()}</span></div>
                  <p className="mt-2 text-xs text-muted-foreground">City transport investment is included in the displayed fare/time. The server recalculates the route, Transport rating and mayor-set tax before charging your character.</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelectedDestination(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={handleBookTravel}
              disabled={!selectedMode || isBooking || !hasValidDeparture || !selectedOption?.available || travelTaxLoading}
            >
              {isBooking ? t("travel.booking") : t("travel.bookTravel")}
              {selectedOption && <span className="ml-2">(${previewTotal.toLocaleString()})</span>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FMPageScaffold>
  );
};

export default Travel;
