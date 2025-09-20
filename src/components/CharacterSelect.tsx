import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { useGameData } from "@/hooks/useGameData";
import { Sparkles, Lock, Unlock } from "lucide-react";

const CHARACTER_SLOT_COST: Record<number, number> = {
  1: 0,
  2: 25000
};

const normalizeUsername = (name: string) => {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base.length === 0) {
    return `rockstar-${Math.random().toString(36).slice(2, 8)}`;
  }

  return base.slice(0, 32);
};

const CharacterSelect = () => {
  const { characters, selectedCharacterId, setActiveCharacter, createCharacter, profile, refreshCharacters, loading } = useGameData();
  const { toast } = useToast();
  const [stageName, setStageName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInitialCharacter = characters.length > 0;
  const hasSecondSlot = characters.length > 1;

  const nextSlotNumber = useMemo(() => {
    if (!hasInitialCharacter) return 1;
    if (!hasSecondSlot) return 2;
    return characters.length + 1;
  }, [characters.length, hasInitialCharacter, hasSecondSlot]);

  const requiredUnlockCost = CHARACTER_SLOT_COST[nextSlotNumber] ?? CHARACTER_SLOT_COST[2];

  const handleCreate = async (makeActive: boolean) => {
    setError(null);

    const trimmed = stageName.trim();
    if (trimmed.length < 3) {
      setError("Please enter a stage name with at least 3 characters.");
      return;
    }

    setCreating(true);

    try {
      const username = normalizeUsername(trimmed);
      await createCharacter({
        username,
        display_name: trimmed,
        slotNumber: nextSlotNumber,
        unlockCost: requiredUnlockCost,
        makeActive
      });

      setStageName("");
      toast({
        title: "Character Created!",
        description: `${trimmed} is ready to rock.`
      });
      await refreshCharacters();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create character.";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const renderCharacterCard = (characterId: string) => {
    const character = characters.find(item => item.id === characterId);
    if (!character) return null;

    const isActive = characterId === selectedCharacterId;

    return (
      <Card key={characterId} className="border-primary/20 bg-card/80 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bebas tracking-wide">
              {character.display_name || character.username}
            </CardTitle>
            <CardDescription>
              Level {character.level ?? 1}
            </CardDescription>
          </div>
          {isActive ? (
            <Badge className="bg-success/20 text-success border-success/40">Active</Badge>
          ) : (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Available
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Cash</span>
            <span className="font-semibold text-success">${Number(character.cash ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Fame</span>
            <span>{Number(character.fame ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Starting Cash</span>
            <span>${Number(character.cash ?? 0).toLocaleString()}</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            disabled={isActive}
            onClick={() => setActiveCharacter(characterId)}
            className="flex-1"
          >
            {isActive ? "Currently Active" : "Activate Character"}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const renderCreationCard = () => {
    const cost = requiredUnlockCost;
    const hasFunds = (profile?.cash ?? 0) >= cost;
    const isSecondSlot = nextSlotNumber > 1;

    return (
      <Card className="border-dashed border-primary/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bebas tracking-wide">
            {isSecondSlot ? <Unlock className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            {isSecondSlot ? "Unlock Second Character" : "Create Your Rockstar"}
          </CardTitle>
          <CardDescription>
            {isSecondSlot
              ? `Purchase an additional character slot for $${cost.toLocaleString()} to explore new playstyles.`
              : "Start your journey with a unique stage name and identity."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={stageName}
            placeholder="Enter stage name"
            onChange={event => setStageName(event.target.value)}
            disabled={creating}
          />
          {isSecondSlot && (
            <Alert className="border-warning/50 bg-warning/10 text-warning-foreground">
              <AlertDescription>
                Unlocking this slot will deduct ${cost.toLocaleString()} from your active character&apos;s cash reserves.
              </AlertDescription>
            </Alert>
          )}
          {isSecondSlot && !hasFunds && (
            <p className="text-sm text-destructive">
              You need ${Math.max(0, cost - (profile?.cash ?? 0)).toLocaleString()} more cash to unlock this slot.
            </p>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => handleCreate(true)}
            disabled={creating || (isSecondSlot && !hasFunds)}
            className="flex-1 bg-gradient-primary"
          >
            {creating ? "Processing..." : isSecondSlot ? `Unlock for $${cost.toLocaleString()}` : "Create Character"}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  if (loading && !characters.length) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading characters...</p>
        </div>
      </div>
    );
  }

  if (!characters.length) {
    return (
      <div className="space-y-4">
        {renderCreationCard()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {characters.map(character => renderCharacterCard(character.id))}
        {!hasSecondSlot && renderCreationCard()}
        {hasSecondSlot && characters.length === 2 && (
          <Card className="border-primary/20 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-bebas tracking-wide">
                <Lock className="h-5 w-5" />
                Additional Slots Coming Soon
              </CardTitle>
              <CardDescription>
                Two characters are currently supported. Stay tuned for more slots in future updates.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CharacterSelect;
