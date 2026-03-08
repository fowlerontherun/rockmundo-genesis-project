import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth-context";
import { useOptionalGameData } from "@/hooks/useGameData";
import { usePlayerCharacterIdentity } from "@/hooks/useCharacterIdentity";
import { useCharacterDeath } from "@/hooks/useCharacterDeath";
import { CharacterDeathScreen } from "@/components/character/CharacterDeathScreen";
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
    deadCharacters,
    hasLivingCharacter,
    hasLivingCharacterLoading,
    createChildCharacter,
    createFreshCharacter,
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
    if (!gameData) {
      return;
    }

    if (!authLoading && !dataLoading && !identityLoading && !hasLivingCharacterLoading && user && profile) {
      // If user has a living character, proceed normally
      if (hasLivingCharacter) {
        const hasCompletedOnboarding = characterIdentity?.onboarding_completed_at != null;
        
        if (!hasCompletedOnboarding) {
          navigate("/onboarding");
        } else {
          navigate("/dashboard");
        }
      }
      // If no living character but has dead ones, the death screen will render below
    }
  }, [authLoading, dataLoading, identityLoading, hasLivingCharacterLoading, gameData, navigate, user, profile, characterIdentity, hasLivingCharacter]);

  // Show death screen if no living character and there are dead ones
  if (!authLoading && user && !hasLivingCharacterLoading && !hasLivingCharacter && deadCharacters.length > 0) {
    const mostRecentDeath = deadCharacters[0];
    return (
      <CharacterDeathScreen
        deadCharacter={mostRecentDeath}
        onCreateChild={(parentId) => {
          createChildCharacter.mutate(parentId, {
            onSuccess: () => navigate("/onboarding"),
          });
        }}
        onCreateFresh={() => {
          createFreshCharacter.mutate(undefined, {
            onSuccess: () => navigate("/onboarding"),
          });
        }}
        isLoading={createChildCharacter.isPending || createFreshCharacter.isPending}
      />
    );
  }

  if (!gameData || authLoading || dataLoading || identityLoading || hasLivingCharacterLoading) {
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
