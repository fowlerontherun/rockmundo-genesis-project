import { useState } from "react";
import { Skull, Baby, Sparkles, Loader2, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { DeadCharacter } from "@/hooks/useCharacterDeath";

interface CharacterDeathScreenProps {
  deadCharacter: DeadCharacter;
  onResurrect: (profileId: string) => void;
  onCreateChild: (parentId: string) => void;
  onCreateFresh: () => void;
  isLoading: boolean;
}

export function CharacterDeathScreen({
  deadCharacter,
  onResurrect,
  onCreateChild,
  onCreateFresh,
  isLoading,
}: CharacterDeathScreenProps) {
  const [choice, setChoice] = useState<"resurrect" | "child" | "fresh" | null>(null);

  const skillCount = Object.keys(deadCharacter.final_skills || {}).length;
  const inheritedCash = Math.floor(deadCharacter.total_cash_at_death * 0.5);

  const livesRemaining = deadCharacter.lives_remaining_at_death ?? 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-stage px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Memorial Header */}
        <Card className="border-destructive/30 bg-card/95">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
              <Skull className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-oswald text-destructive">
              Your Character Has Died
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Avatar className="h-16 w-16 border-2 border-destructive/30">
                <AvatarImage src={deadCharacter.avatar_url || undefined} />
                <AvatarFallback className="bg-destructive/20 text-destructive font-bold text-lg">
                  {(deadCharacter.character_name || "?")[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <h3 className="font-bold text-lg">{deadCharacter.character_name}</h3>
                <p className="text-sm text-muted-foreground">
                  Cause: {deadCharacter.cause_of_death}
                </p>
                {deadCharacter.generation_number > 1 && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Generation {deadCharacter.generation_number}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-muted-foreground">Fame</div>
                <div className="font-bold text-lg">{(deadCharacter.total_fame || 0).toLocaleString()}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-muted-foreground">Cash at Death</div>
                <div className="font-bold text-lg">${(deadCharacter.total_cash_at_death || 0).toLocaleString()}</div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground italic">
              They have been immortalized in the Hall of Immortals.
            </p>
            <p className="text-sm font-medium text-primary">
              Resurrection lives remaining: {livesRemaining} / 3
            </p>
          </CardContent>
        </Card>

        {/* Choices */}
        <div className="grid gap-4">
          {livesRemaining > 0 && (
            <Card
              className={`cursor-pointer transition-all hover:border-emerald-500/50 ${
                choice === "resurrect" ? "border-emerald-500 ring-2 ring-emerald-500/20" : ""
              }`}
              onClick={() => setChoice("resurrect")}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <HeartPulse className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="font-bold">Resurrect {deadCharacter.character_name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Continue exactly where you left off. This uses <span className="font-medium text-emerald-500">1 life</span>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card
            className={`cursor-pointer transition-all hover:border-primary/50 ${
              choice === "child" ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => setChoice("child")}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <Baby className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold">Play as Child of {deadCharacter.character_name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Inherit <span className="text-primary font-medium">10% of skills</span> ({skillCount} skills) and{" "}
                    <span className="text-primary font-medium">50% of cash</span> (${inheritedCash.toLocaleString()}).
                    Continue the family legacy.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:border-accent/50 ${
              choice === "fresh" ? "border-accent ring-2 ring-accent/20" : ""
            }`}
            onClick={() => setChoice("fresh")}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-bold">Start Fresh</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a brand new character with no inheritance. A clean slate with $10,000 starting cash.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={!choice || isLoading}
          onClick={() => {
            if (choice === "resurrect") onResurrect(deadCharacter.profile_id);
            else if (choice === "child") onCreateChild(deadCharacter.id);
            else if (choice === "fresh") onCreateFresh();
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating character...
            </>
          ) : choice === "resurrect" ? (
            "Resurrect and Continue"
          ) : choice === "child" ? (
            "Continue the Legacy"
          ) : choice === "fresh" ? (
            "Start Fresh"
          ) : (
            "Choose an option above"
          )}
        </Button>
      </div>
    </div>
  );
}
