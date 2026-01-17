import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Plane, Train, Bus, Ship, ArrowRight, AlertCircle, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "sonner";
import { format, isPast, isFuture } from "date-fns";

interface UpcomingTravelListProps {
  userId: string;
}

interface TravelPlan {
  id: string;
  from_city: { name: string; country: string } | null;
  to_city: { name: string; country: string };
  transport_type: string;
  cost_paid: number;
  travel_duration_hours: number;
  departure_time: string;
  arrival_time: string;
  status: string;
  source: "manual" | "tour";
  tour_name?: string;
}

const TRANSPORT_ICONS = {
  train: Train,
  plane: Plane,
  bus: Bus,
  ship: Ship,
} as const;

export const UpcomingTravelList = ({ userId }: UpcomingTravelListProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedTravelId, setSelectedTravelId] = useState<string | null>(null);

  const { data: upcomingTravel, isLoading } = useQuery({
    queryKey: ["upcoming-travel", userId],
    queryFn: async () => {
      // Fetch manual travel bookings that are scheduled or in progress
      const { data: manualTravel, error: manualError } = await supabase
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
        .in("status", ["scheduled", "in_progress"])
        .order("departure_time", { ascending: true });

      if (manualError) throw manualError;

      // Fetch tour travel legs (for tours the user is part of)
      const { data: bandMemberships } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);

      const bandIds = bandMemberships?.map(m => m.band_id) || [];

      let tourTravel: TravelPlan[] = [];
      if (bandIds.length > 0) {
        // Get tour IDs for bands user is in
        const { data: tours } = await supabase
          .from("tours")
          .select("id, name")
          .in("band_id", bandIds);

        const tourIds = tours?.map(t => t.id) || [];
        
        if (tourIds.length > 0) {
          const { data: tourLegs } = await supabase
            .from("tour_travel_legs")
            .select(`
              id,
              tour_id,
              from_city_id,
              to_city_id,
              travel_mode,
              travel_cost,
              travel_duration_hours,
              departure_date,
              arrival_date
            `)
            .in("tour_id", tourIds)
            .gte("departure_date", new Date().toISOString())
            .order("departure_date", { ascending: true });

          if (tourLegs && tourLegs.length > 0) {
            const tourMap = new Map(tours?.map(t => [t.id, t.name]) || []);
            
            // Collect all city IDs from tour legs
            const tourCityIds = [...new Set([
              ...tourLegs.map(l => l.from_city_id),
              ...tourLegs.map(l => l.to_city_id)
            ])].filter(Boolean);
            
            // Fetch city data for tour legs
            const { data: tourCities } = await supabase
              .from("cities")
              .select("id, name, country")
              .in("id", tourCityIds);
            
            const tourCityMap = new Map(tourCities?.map(c => [c.id, { name: c.name, country: c.country }]) || []);
            
            tourTravel = tourLegs.map(leg => ({
              id: leg.id,
              from_city: tourCityMap.get(leg.from_city_id) || null,
              to_city: tourCityMap.get(leg.to_city_id) || { name: "Unknown", country: "" },
              transport_type: leg.travel_mode || "bus",
              cost_paid: leg.travel_cost || 0,
              travel_duration_hours: leg.travel_duration_hours || 0,
              departure_time: leg.departure_date,
              arrival_time: leg.arrival_date,
              status: "scheduled",
              source: "tour" as const,
              tour_name: tourMap.get(leg.tour_id) || "Tour",
            }));
          }
        }
      }

      // Collect all city IDs from manual travel
      const manualCityIds = [...new Set([
        ...(manualTravel || []).map(t => t.from_city_id),
        ...(manualTravel || []).map(t => t.to_city_id)
      ])].filter(Boolean) as string[];

      // Fetch city data for manual travel
      let manualCityMap = new Map<string, { name: string; country: string }>();
      if (manualCityIds.length > 0) {
        const { data: manualCities } = await supabase
          .from("cities")
          .select("id, name, country")
          .in("id", manualCityIds);
        
        manualCityMap = new Map(manualCities?.map(c => [c.id, { name: c.name, country: c.country }]) || []);
      }

      // Combine and sort by departure time
      const allTravel: TravelPlan[] = [
        ...(manualTravel || []).map(t => ({
          id: t.id,
          from_city: t.from_city_id ? manualCityMap.get(t.from_city_id) || null : null,
          to_city: manualCityMap.get(t.to_city_id) || { name: "Unknown", country: "" },
          transport_type: t.transport_type,
          cost_paid: t.cost_paid,
          travel_duration_hours: t.travel_duration_hours,
          departure_time: t.departure_time,
          arrival_time: t.arrival_time,
          status: t.status,
          source: "manual" as const,
        })),
        ...tourTravel,
      ].sort((a, b) => 
        new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime()
      );

      return allTravel;
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const cancelTravelMutation = useMutation({
    mutationFn: async (travelId: string) => {
      const travel = upcomingTravel?.find(t => t.id === travelId);
      if (!travel || travel.source !== "manual") {
        throw new Error("Cannot cancel this travel");
      }

      // Check if departure is in the past
      if (isPast(new Date(travel.departure_time))) {
        throw new Error("Cannot cancel travel that has already departed");
      }

      // Update status and refund
      const { error: updateError } = await supabase
        .from("player_travel_history")
        .update({ status: "cancelled" })
        .eq("id", travelId);

      if (updateError) throw updateError;

      // Refund the cost by updating profile directly
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", userId)
        .single();

      if (profile) {
        await supabase
          .from("profiles")
          .update({ cash: (profile.cash || 0) + travel.cost_paid })
          .eq("user_id", userId);
      }

      return travel;
    },
    onSuccess: (travel) => {
      toast.success(`Travel cancelled! $${travel.cost_paid.toLocaleString()} refunded.`);
      queryClient.invalidateQueries({ queryKey: ["upcoming-travel"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel travel");
    },
  });

  const getTransportIcon = (type: string) => {
    const Icon = TRANSPORT_ICONS[type.toLowerCase() as keyof typeof TRANSPORT_ICONS] || Train;
    return <Icon className="h-4 w-4" />;
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "MMM d, h:mm a");
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
  };

  const getStatusBadge = (status: string, departureTime: string) => {
    const departure = new Date(departureTime);
    const now = new Date();

    if (status === "in_progress" || (isPast(departure) && status === "scheduled")) {
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">In Transit</Badge>;
    }
    return <Badge variant="secondary">Scheduled</Badge>;
  };

  const handleCancelClick = (travelId: string) => {
    setSelectedTravelId(travelId);
    setCancelDialogOpen(true);
  };

  const confirmCancel = () => {
    if (selectedTravelId) {
      cancelTravelMutation.mutate(selectedTravelId);
    }
    setCancelDialogOpen(false);
    setSelectedTravelId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse h-24 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (!upcomingTravel || upcomingTravel.length === 0) {
    return (
      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertDescription>
          {t('travel.noUpcoming', "You don't have any upcoming travel plans. Book a trip to get started!")}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {upcomingTravel.map((travel) => {
        const canCancel = travel.source === "manual" && isFuture(new Date(travel.departure_time));
        
        return (
          <Card key={travel.id} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  {/* Route */}
                  <div className="flex items-center gap-2 font-semibold">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {travel.from_city ? (
                      <>
                        <span>{travel.from_city.name}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span>{travel.to_city.name}</span>
                      </>
                    ) : (
                      <span>{travel.to_city.name}</span>
                    )}
                  </div>

                  {/* Details Row */}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <Badge variant="outline" className="flex items-center gap-1">
                      {getTransportIcon(travel.transport_type)}
                      <span className="capitalize">{travel.transport_type}</span>
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(travel.travel_duration_hours)}
                    </span>
                    <span>${travel.cost_paid.toLocaleString()}</span>
                  </div>

                  {/* Times */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Departs: </span>
                      <span className="font-medium">{formatDateTime(travel.departure_time)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Arrives: </span>
                      <span className="font-medium">{formatDateTime(travel.arrival_time)}</span>
                    </div>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {travel.source === "tour" && (
                      <Badge variant="outline" className="text-xs">
                        🎸 {travel.tour_name || "Tour"}
                      </Badge>
                    )}
                    {getStatusBadge(travel.status, travel.departure_time)}
                  </div>
                  
                  {canCancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleCancelClick(travel.id)}
                      disabled={cancelTravelMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Travel Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your travel and refund the full cost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Travel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
