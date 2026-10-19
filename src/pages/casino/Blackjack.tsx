import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Club } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * P0 #4222: the previous game used browser-dealt cards and browser-supplied
 * winnings. Until blackjack has a persisted server deck/hand protocol, it
 * MUST NOT submit client-chosen outcomes or debit player cash.
 */
export default function Blackjack() {
  const navigate = useNavigate();

  return (
    <FMPageScaffold
      title="Blackjack"
      subtitle="Secure table maintenance"
      icon={Club}
      backTo="/casino"
      backLabel="Casino"
      className="max-w-lg mx-auto"
    >
      <Card>
        <CardContent className="py-8 space-y-4 text-center" role="alert">
          <h2 className="text-xl font-semibold">Blackjack temporarily unavailable</h2>
          <p className="text-sm text-muted-foreground">
            We are moving the cards, dealer decisions and wager settlement onto
            the game server so that no player can claim unverified winnings.
            No wager can be placed until that secure table is ready.
          </p>
          <Button onClick={() => navigate("/casino")}>Back to Casino</Button>
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
}
