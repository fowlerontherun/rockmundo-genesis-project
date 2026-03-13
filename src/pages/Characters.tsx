import { Loader2, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLayout } from "@/components/ui/PageLayout";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";

export default function Characters() {
  const { slots, slotsLoading, characters, switchCharacter } = useCharacterSlots();
  const { toast } = useToast();
  const [switchingToId, setSwitchingToId] = useState<string | null>(null);

  const activeCharacter = characters.find((character) => character.is_active);
  const maxSlots = slots?.maxSlots ?? 2;

  const handleSwitch = async (profileId: string) => {
    if (profileId === activeCharacter?.id) return;

    setSwitchingToId(profileId);
    try {
      await switchCharacter.mutateAsync(profileId);
      toast({ title: "Character switched", description: "Reloading your game state..." });
      window.location.reload();
    } catch {
      toast({ title: "Error", description: "Failed to switch character", variant: "destructive" });
    } finally {
      setSwitchingToId(null);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Characters"
        subtitle="See all of your character slots and switch who you are currently playing."
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Slot Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {slotsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Used slots</span>
                  <span className="font-semibold">{slots?.usedSlots ?? 0} / {maxSlots}</span>
                </div>
                <Progress value={((slots?.usedSlots ?? 0) / maxSlots) * 100} />
                <p className="text-xs text-muted-foreground">
                  You can have up to {maxSlots} total slots. Buy additional slots to expand your roster.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Characters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {characters.map((character) => {
              const isActive = character.is_active;
              const isSwitching = switchingToId === character.id;

              return (
                <div key={character.id} className="flex items-center gap-3 rounded-md border p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={character.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {(character.display_name || character.username || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{character.display_name || character.username || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">
                      Level {character.level} • {(character.fame || 0).toLocaleString()} fame
                    </p>
                  </div>

                  {character.generation_number > 1 && (
                    <Badge variant="outline" className="text-[10px]">Gen {character.generation_number}</Badge>
                  )}

                  {isActive ? (
                    <Badge className="bg-primary/20 text-primary border-primary/30">Active</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSwitch(character.id)}
                      disabled={isSwitching || switchCharacter.isPending}
                    >
                      {isSwitching ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-1 h-3.5 w-3.5" /> Switch</>}
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
