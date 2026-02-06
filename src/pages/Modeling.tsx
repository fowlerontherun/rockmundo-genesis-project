import { useGameData } from "@/hooks/useGameData";
import { useAuth } from "@/hooks/use-auth-context";
import { ModelingOffersPanel } from "@/components/modeling/ModelingOffersPanel";

export default function Modeling() {
  const { user } = useAuth();
  const { profile } = useGameData();

  if (!user || !profile) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Please log in to access modeling.</p>
      </div>
    );
  }

  // Looks are derived from fame (no dedicated column yet) — baseline 50
  const playerLooks = Math.min(100, 50 + Math.floor((profile.fame ?? 0) / 100));
  const playerFame = profile.fame ?? 0;

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <ModelingOffersPanel
        userId={user.id}
        playerLooks={playerLooks}
        playerFame={playerFame}
      />
    </div>
  );
}
