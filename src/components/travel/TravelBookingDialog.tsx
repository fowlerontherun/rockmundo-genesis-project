import { useState, useEffect, useContext } from "react";
import { AuthContext } from "@/hooks/use-auth-context";
import { useTravelBooking } from "@/hooks/useTravelBooking";
import { getAvailableRoutes, calculateTravelCost, TravelRoute } from "@/utils/travelSystem";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Train, Plane, Bus, Ship, Clock, DollarSign, Star, Loader2 } from "lucide-react";

interface TravelBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCityId: string | null;
  currentCityName?: string;
  preselectedDestinationId?: string;
}

const TRANSPORT_ICONS = {
  train: Train,
  plane: Plane,
  bus: Bus,
  ship: Ship,
} as const;

export function TravelBookingDialog({
  open,
  onOpenChange,
  currentCityId,
  currentCityName,
  preselectedDestinationId,
}: TravelBookingDialogProps) {
  const { user } = useContext(AuthContext);
  const travelMutation = useTravelBooking();
  const [routes, setRoutes] = useState<TravelRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<TravelRoute | null>(null);
  const [playerMoney, setPlayerMoney] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && currentCityId) {
      loadRoutesAndMoney();
    }
  }, [open, currentCityId]);

  useEffect(() => {
    if (preselectedDestinationId && routes.length > 0) {
      const route = routes.find(r => r.to_city_id === preselectedDestinationId);
      if (route) setSelectedRoute(route);
    }
  }, [preselectedDestinationId, routes]);

  const loadRoutesAndMoney = async () => {
    if (!currentCityId || !user) return;
    
    setLoading(true);
    try {
      const availableRoutes = await getAvailableRoutes(currentCityId);
      setRoutes(availableRoutes);

      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();

      setPlayerMoney(profile?.cash || 0);
    } catch (error) {
      console.error("Error loading travel data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookTravel = async () => {
    if (!selectedRoute || !user || !currentCityId) return;

    const cost = calculateTravelCost(selectedRoute.base_cost, selectedRoute.comfort_rating || 50);

    await travelMutation.mutateAsync({
      userId: user.id,
      fromCityId: currentCityId,
      toCityId: selectedRoute.to_city_id,
      routeId: selectedRoute.id,
      transportType: selectedRoute.transport_type,
      cost,
      durationHours: selectedRoute.duration_hours,
      comfortRating: selectedRoute.comfort_rating || 50,
    });

    onOpenChange(false);
  };

  const canAfford = selectedRoute 
    ? playerMoney >= calculateTravelCost(selectedRoute.base_cost, selectedRoute.comfort_rating || 50)
    : false;

  const TransportIcon = selectedRoute 
    ? TRANSPORT_ICONS[selectedRoute.transport_type.toLowerCase() as keyof typeof TRANSPORT_ICONS] || Train
    : Train;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book Travel</DialogTitle>
          <DialogDescription>
            Choose your destination from {currentCityName || "your current location"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm font-medium">Your Balance:</span>
              <Badge variant="outline" className="text-base">
                <DollarSign className="h-4 w-4 mr-1" />
                {playerMoney.toLocaleString()}
              </Badge>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Destination</label>
              <Select
                value={selectedRoute?.id}
                onValueChange={(value) => {
                  const route = routes.find(r => r.id === value);
                  setSelectedRoute(route || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a city..." />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.to_city?.name}, {route.to_city?.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRoute && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-3">
                      <TransportIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold capitalize">{selectedRoute.transport_type}</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedRoute.to_city?.name}, {selectedRoute.to_city?.country}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-xs">Cost</span>
                      </div>
                      <p className="text-lg font-semibold">
                        ${calculateTravelCost(selectedRoute.base_cost, selectedRoute.comfort_rating || 50).toLocaleString()}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs">Duration</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {selectedRoute.duration_hours}h
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Star className="h-4 w-4" />
                        <span className="text-xs">Comfort</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {selectedRoute.comfort_rating || 50}%
                      </p>
                    </div>
                  </div>

                  {!canAfford && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      Insufficient funds for this travel option
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBookTravel}
                disabled={!selectedRoute || !canAfford || travelMutation.isPending}
                className="flex-1"
              >
                {travelMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Traveling...
                  </>
                ) : (
                  "Confirm Travel"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
