import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth-context";
import { useOptionalGameData } from "@/hooks/useGameData";
import { usePlayerCharacterIdentity } from "@/hooks/useCharacterIdentity";
import { useCharacterDeath } from "@/hooks/useCharacterDeath";
import NoActiveCharacterGate from "@/components/character/NoActiveCharacterGate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const gameData = useOptionalGameData();
  const profile = gameData?.profile ?? null;
  const dataLoading = gameData?.loading ?? true;
  const error = gameData?.error;
  
  const { data: characterIdentity, isLoading: identityLoading } = usePlayerCharacterIdentity();
  const {
    deadCharactersLoading,
    hasLivingCharacter,
    hasLivingCharacterLoading,
    updateLastLogin,
  } = useCharacterDeath();

  // Update last_login_at on the active profile whenever user loads
  useEffect(() => {
    if (user && !authLoading) {
      updateLastLogin.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // Don't navigate until all loading is done
    if (authLoading || identityLoading || hasLivingCharacterLoading || deadCharactersLoading) return;
    if (!user) return;

    // If user has a living character, proceed normally
    if (hasLivingCharacter) {
      // Wait for game data to load before checking onboarding
      if (!gameData || dataLoading) return;
      
      const hasCompletedOnboarding = characterIdentity?.onboarding_completed_at != null;
      if (!hasCompletedOnboarding) {
        navigate("/onboarding");
      } else {
        navigate("/home");
      }
    }
    // If no living character, the death screen or fresh start will render below
  }, [authLoading, dataLoading, identityLoading, hasLivingCharacterLoading, deadCharactersLoading, gameData, navigate, user, profile, characterIdentity, hasLivingCharacter]);

  // No living character: show the revive / create choice immediately.
  if (!authLoading && user && !hasLivingCharacterLoading && !deadCharactersLoading && !hasLivingCharacter) {
    return <NoActiveCharacterGate>{null}</NoActiveCharacterGate>;
  }

  if (authLoading || identityLoading || hasLivingCharacterLoading || deadCharactersLoading || (!gameData && user) || (user && dataLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage px-4">
        <div className="w-full max-w-md space-y-6 rounded-xl bg-background/95 p-8 text-center shadow-xl">
          <Alert variant="destructive" className="text-left">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>We couldn&apos;t load your profile</AlertTitle>
            <AlertDescription>{typeof error === 'string' ? error : 'An unexpected error occurred'}</AlertDescription>
          </Alert>
          <Button onClick={() => navigate("/my-character/edit")}>Open character</Button>
        </div>
      </div>
    );
  }

  return null;
};

export default Index;
