import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plane, MapPin, Clock, Crown } from "lucide-react";
import { useUpcomingGigWarning } from "@/hooks/useUpcomingGigWarning";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useGameData } from "@/hooks/useGameData";
import { useAuth } from "@/hooks/use-auth-context";
import { bookCharterFlight, CHARTER_FLIGHT_COST } from "@/utils/charterFlight";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export const GigLocationWarning = () => {
  const { data: warning, isLoading } = useUpcomingGigWarning();
  const { data: vipStatus } = useVipStatus();
  const { profile } = useGameData();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isBooking, setIsBooking] = useState(false);

  if (isLoading || !warning?.needsWarning) {
    return null;
  }

  const handleCharterFlight = async () => {
    if (!user?.id || !profile) return;

    setIsBooking(true);
    try {
      const result = await bookCharterFlight(
        user.id,
        profile.cash || 0,
        warning.gigId,
        warning.gigDate,
        warning.venueCityId,
        warning.venueCity,
        warning.playerCurrentCityId || "",
        warning.playerCurrentCityName
      );

      if (result.success) {
        toast({
          title: "Charter Flight Booked! ✈️",
          description: result.message,
        });
        // Refresh all relevant queries
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["game-data"] });
        queryClient.invalidateQueries({ queryKey: ["upcoming-gig-warning"] });
      } else {
        toast({
          title: "Booking Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to book charter flight. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBooking(false);
    }
  };

  const canAffordCharter = (profile?.cash || 0) >= CHARTER_FLIGHT_COST;

  return (
    <Alert variant="destructive" className="mb-4 border-destructive/50 bg-destructive/10">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="flex items-center gap-2 text-lg font-bold">
        ⚠️ URGENT: Gig Location Warning!
      </AlertTitle>
      <AlertDescription className="mt-3 space-y-4">
        <div className="flex flex-col gap-2">
          <p className="text-foreground">
            Your gig with <strong>{warning.bandName}</strong> at{" "}
            <strong>{warning.venueName}</strong> is in{" "}
            <Badge variant="outline" className="mx-1">
              <Clock className="h-3 w-3 mr-1" />
              {warning.hoursUntilGig} hours
            </Badge>
          </p>
          <p className="text-muted-foreground">
            <MapPin className="h-4 w-4 inline mr-1" />
            You're in <strong>{warning.playerCurrentCityName}</strong> but the gig is in{" "}
            <strong>{warning.venueCity}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Show time: {format(warning.gigDate, "EEEE, MMM d 'at' h:mm a")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {vipStatus?.isVip ? (
            <div className="flex-1 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">VIP Option</span>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Plane className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Charter Private Jet</p>
                    <p className="text-xs text-muted-foreground">
                      ${CHARTER_FLIGHT_COST.toLocaleString()} - Arrives 1 hour before show
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleCharterFlight}
                  disabled={isBooking || !canAffordCharter}
                >
                  {isBooking ? "Booking..." : canAffordCharter ? "Book Charter" : "Can't Afford"}
                </Button>
              </div>
              {!canAffordCharter && (
                <p className="text-xs text-destructive mt-2">
                  You need ${CHARTER_FLIGHT_COST.toLocaleString()} (current: ${(profile?.cash || 0).toLocaleString()})
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 p-3 rounded-lg border border-muted bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">VIP members can charter private jets</span>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => navigate("/travel")}
            className="whitespace-nowrap"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Book Regular Travel
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
