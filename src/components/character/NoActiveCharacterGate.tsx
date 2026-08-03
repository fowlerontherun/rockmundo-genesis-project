import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth-context";
import { useCharacterDeath } from "@/hooks/useCharacterDeath";
import { CharacterDeathScreen } from "@/components/character/CharacterDeathScreen";
import { Button } from "@/components/ui/button";

interface NoActiveCharacterGateProps {
  children: ReactNode;
}

/**
 * Global gate: any signed-in account without a living character is immediately
 * shown the revive / create-new-character choice, no matter which page they
 * landed on. Accounts with no characters at all get the first-character screen.
 */
export const NoActiveCharacterGate = ({ children }: NoActiveCharacterGateProps) => {
  const { user, loading: authLoading } = useAuth();
  const {
    deadCharacters,
    deadCharactersLoading,
    hasLivingCharacter,
    hasLivingCharacterLoading,
    resurrectCharacter,
    createChildCharacter,
    createFreshCharacter,
  } = useCharacterDeath();

  // Unauthenticated (or still resolving auth) — let the normal auth flow run.
  if (authLoading || !user) return <>{children}</>;

  if (hasLivingCharacterLoading || deadCharactersLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage" role="status" aria-busy="true">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (hasLivingCharacter) return <>{children}</>;

  const isMutating =
    resurrectCharacter.isPending || createChildCharacter.isPending || createFreshCharacter.isPending;

  if (deadCharacters.length > 0) {
    return (
      <CharacterDeathScreen
        deadCharacter={deadCharacters[0]}
        onResurrect={(profileId) => {
          resurrectCharacter.mutate(profileId, {
            onSuccess: () => {
              window.location.href = "/home";
            },
          });
        }}
        onCreateChild={(parentId, opts) => {
          createChildCharacter.mutate(
            { parentProfileId: parentId, displayName: opts.displayName, username: opts.username },
            {
              onSuccess: () => {
                window.location.href = "/onboarding";
              },
            }
          );
        }}
        onCreateFresh={(opts) => {
          createFreshCharacter.mutate(opts, {
            onSuccess: () => {
              window.location.href = "/onboarding";
            },
          });
        }}
        isLoading={isMutating}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-stage px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-background/95 p-8 text-center shadow-xl">
        <h2 className="text-xl font-bold">Welcome to RockMundo</h2>
        <p className="text-sm text-muted-foreground">
          Let's create your first character. You can personalize everything in onboarding right after.
        </p>
        <Button
          onClick={() => {
            createFreshCharacter.mutate(undefined, {
              onSuccess: () => {
                window.location.href = "/onboarding";
              },
            });
          }}
          disabled={createFreshCharacter.isPending}
        >
          {createFreshCharacter.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create New Character"
          )}
        </Button>
      </div>
    </div>
  );
};

export default NoActiveCharacterGate;
