import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useGameData } from "@/hooks/useGameData";

interface CharacterGateProps {
  children: ReactNode;
}

export const CharacterGate = ({ children }: CharacterGateProps) => {
  const { loading, error, profile, refetch } = useGameData();
  const location = useLocation();
  const navigate = useNavigate();

  const allowWithoutProfile = (() => {
    const currentPath = location.pathname;
    return currentPath === "/" || currentPath === "/profile" || currentPath.startsWith("/profile/");
  })();

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
            <Button onClick={() => refetch()} variant="secondary">
              Retry
            </Button>
            <Button onClick={() => navigate("/profile")}>Open profile</Button>
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
            You need an artist profile before exploring Rockmundo. Head to the profile page to name your performer and claim
            your London launch pad.
          </p>
          <Button className="bg-gradient-primary" onClick={() => navigate("/profile")}>Go to profile</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default CharacterGate;
