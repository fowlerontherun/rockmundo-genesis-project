import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useGameData } from "@/hooks/useGameData";

interface CharacterGateProps {
  children: ReactNode;
}

export const CharacterGate = ({ children }: CharacterGateProps) => {
  const { loading, error, hasCharacters, selectedCharacterId, characters, refreshCharacters } = useGameData();
  const location = useLocation();
  const navigate = useNavigate();

  const allowWithoutCharacter = (() => {
    const currentPath = location.pathname;

    if (currentPath === "/") {
      return true;
    }

    if (currentPath === "/character-create" || currentPath.startsWith("/character-create/")) {
      return true;
    }

    return currentPath === "/profile" || currentPath.startsWith("/profile/");
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading your character data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-stage p-6 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTitle>Unable to load character data</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => refreshCharacters()} variant="secondary">
              Retry
            </Button>
            <Button onClick={() => navigate("/profile")}>
              Manage Characters
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!hasCharacters && !allowWithoutCharacter) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="max-w-lg text-center space-y-4 bg-card/90 border border-primary/20 rounded-xl p-8">
          <h2 className="text-3xl font-bebas tracking-wider">Create Your First Character</h2>
          <p className="text-muted-foreground">
            Before you can explore Rockmundo you&apos;ll need to create a performer profile.
            Head over to the profile page to design your stage persona.
          </p>
          <Button className="bg-gradient-primary" onClick={() => navigate("/profile")}>Create Character</Button>
        </div>
      </div>
    );
  }

  if (hasCharacters && !selectedCharacterId && !allowWithoutCharacter) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="max-w-lg text-center space-y-4 bg-card/90 border border-primary/20 rounded-xl p-8">
          <h2 className="text-3xl font-bebas tracking-wider">Activate a Character</h2>
          <p className="text-muted-foreground">
            You have {characters.length} character{characters.length === 1 ? "" : "s"} available. Choose one from the profile
            page before continuing your adventure.
          </p>
          <Button variant="outline" onClick={() => navigate("/profile")}>Open Character Manager</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default CharacterGate;
