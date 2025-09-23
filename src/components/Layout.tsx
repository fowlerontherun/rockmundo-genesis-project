import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Navigation from "@/components/ui/navigation";
import CharacterGate from "@/components/CharacterGate";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameDataSimplified";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import PlayerCommunityStats from "@/components/PlayerCommunityStats";
import { useCommunityStats } from "@/hooks/useCommunityStats";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: dataLoading, error: profileError } = useGameData();
  const {
    registeredPlayers,
    registeredLoading,
    registeredError,
    livePlayers,
    livePlayersConnected,
  } = useCommunityStats({ presenceUserId: user?.id });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const isOnProfile = location.pathname === "/my-character";

    if (!authLoading && !dataLoading && user && !profile && !isOnProfile) {
      navigate("/my-character");
    }
  }, [authLoading, dataLoading, user, profile, location.pathname, navigate]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-stage">
        <div className="text-center">
          <div className="mx-auto mb-4 h-32 w-32 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-lg font-oswald">Loading Rockmundo...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <Navigation />
      <main className="flex-1 overflow-y-auto pb-16 lg:ml-0 lg:pb-0">
        <header className="bg-muted py-2 text-muted-foreground">
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-1 px-4 text-center">
            <span className="font-oswald text-xs uppercase tracking-[0.35em] text-muted-foreground/80 sm:text-sm">
              DEMO - In Development
            </span>
            <PlayerCommunityStats
              registeredPlayers={registeredPlayers}
              registeredLoading={registeredLoading}
              registeredError={registeredError}
              livePlayers={livePlayers}
              livePlayersConnected={livePlayersConnected}
              size="sm"
              className="text-muted-foreground/90"
            />
          </div>
        </header>
        <div className="pt-12 lg:pt-0">
          {profileError && (
            <div className="px-4 pt-4 lg:px-6">
              <Alert variant="destructive" className="max-w-2xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Profile error</AlertTitle>
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            </div>
          )}
          <CharacterGate>
            <Outlet />
          </CharacterGate>
        </div>
      </main>
    </div>
  );
};

export default Layout;
