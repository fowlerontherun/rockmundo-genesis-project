import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useGameData } from "@/hooks/useGameData";
import { useTravelStatus } from "@/hooks/useTravelStatus";
import { TravelProgressOverlay } from "@/components/travel/TravelProgressOverlay";
import { Lock } from "lucide-react";

interface CharacterGateProps {
  children: ReactNode;
}

export const CharacterGate = ({ children }: CharacterGateProps) => {
  const { loading, error, profile, refetch } = useGameData();
  const { travelStatus, cancelTravel } = useTravelStatus();
  const location = useLocation();
  const navigate = useNavigate();

  const allowWithoutProfile = (() => {
    const currentPath = location.pathname;
    return currentPath === "/" || currentPath === "/my-character/edit" || currentPath.startsWith("/my-character/");
  })();

  // Paths allowed while imprisoned
  const allowedWhileImprisoned = ["/prison", "/songwriting", "/my-character", "/"];
  const isAllowedWhileImprisoned = allowedWhileImprisoned.some(p => location.pathname.startsWith(p));

  // Paths allowed while traveling (limited activities)
  const allowedWhileTraveling = [
    "/songwriting", 
    "/library", 
    "/twaater", 
    "/dikcok",
    "/my-character",
    "/travel",
    "/"
  ];
  const isAllowedWhileTraveling = allowedWhileTraveling.some(p => location.pathname.startsWith(p));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-24 w-24 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-lg font-oswald">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage p-6">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTitle>Unable to load your profile</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => refetch()} variant="secondary">Retry</Button>
            <Button onClick={() => navigate("/my-character/edit")}>Open character</Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!profile && !allowWithoutProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage p-6">
        <div className="max-w-lg space-y-4 rounded-xl border border-primary/20 bg-card/95 p-8 text-center shadow-lg">
          <h2 className="text-3xl font-bebas tracking-wide">Create your artist</h2>
          <p className="text-muted-foreground">
            You need an artist profile before exploring Rockmundo. Head to the profile page to name your performer and claim your London launch pad.
          </p>
          <Button className="bg-gradient-primary" onClick={() => navigate("/my-character/edit")}>Go to character</Button>
        </div>
      </div>
    );
  }

  // Prison blocking - redirect to prison page if imprisoned and trying to access restricted areas
  if ((profile as any)?.is_imprisoned && !isAllowedWhileImprisoned) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage p-6">
        <div className="max-w-lg space-y-4 rounded-xl border border-destructive/20 bg-card/95 p-8 text-center shadow-lg">
          <Lock className="h-16 w-16 mx-auto text-destructive" />
          <h2 className="text-3xl font-bebas tracking-wide text-destructive">You Are Imprisoned</h2>
          <p className="text-muted-foreground">
            Most activities are restricted while in prison. You can only write songs from your cell.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="destructive" onClick={() => navigate("/prison")}>Go to Prison</Button>
            <Button variant="outline" onClick={() => navigate("/songwriting")}>Write Songs</Button>
          </div>
        </div>
      </div>
    );
  }

  // Travel blocking - show travel overlay when traveling and trying to access restricted areas
  if (travelStatus?.is_traveling && !isAllowedWhileTraveling && travelStatus.destination_city_name) {
    const handleCancelTravel = () => {
      if (travelStatus.travel_id) {
        cancelTravel(travelStatus.travel_id);
      }
    };
    
    return (
      <TravelProgressOverlay
        destinationCity={travelStatus.destination_city_name}
        departureCity={travelStatus.current_city_name || undefined}
        arrivalTime={new Date(travelStatus.travel_arrives_at || Date.now())}
        departureTime={new Date(travelStatus.departure_time || Date.now())}
        transportType={travelStatus.transport_type || "plane"}
        onCancel={handleCancelTravel}
        canCancel={!!travelStatus.travel_id}
      />
    );
  }

  return <>{children}</>;
};

export default CharacterGate;
