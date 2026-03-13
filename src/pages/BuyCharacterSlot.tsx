import { useState } from "react";
import { Users, Plus, ShieldCheck, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export default function BuyCharacterSlot() {
  const { slots, slotsLoading, characters, switchCharacter } = useCharacterSlots();
  const [purchasing, setPurchasing] = useState(false);
  const [switchingToId, setSwitchingToId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const maxPossible = 5;
  const currentMax = slots?.maxSlots ?? 2;
  const canBuyMore = currentMax < maxPossible;
  const activeCharacter = characters.find((char) => char.is_active);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-slot-checkout");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start checkout", variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

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
      <PageHeader title="Character Slots" subtitle="Manage your roster, switch characters, and buy extra slots in one place." />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Your Characters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {slotsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Used slots</span>
                  <span className="font-bold">{slots?.usedSlots ?? 0} / {currentMax}</span>
                </div>
                <Progress value={((slots?.usedSlots ?? 0) / currentMax) * 100} />

                <div className="space-y-2 pt-1">
                  {characters.map((char) => {
                    const isActive = char.is_active;
                    const isSwitching = switchingToId === char.id;

                    return (
                      <div key={char.id} className="flex items-center gap-2 text-sm rounded-md border p-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={char.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {(char.display_name || char.username || "?")[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{char.display_name || char.username || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">Lv.{char.level} • {(char.fame || 0).toLocaleString()} fame</p>
                        </div>

                        {isActive ? (
                          <Badge className="text-[10px] bg-primary/20 text-primary">Active</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() => handleSwitch(char.id)}
                            disabled={isSwitching || switchCharacter.isPending}
                          >
                            {isSwitching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RefreshCw className="mr-1 h-3.5 w-3.5" /> Switch</>}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {slots?.canCreateNew && (
                  <Button className="w-full" onClick={() => navigate("/characters/new")}> 
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Character
                  </Button>
                )}

                <div className="text-xs text-muted-foreground">
                  Extra slots purchased: {slots?.extraSlotsPurchased ?? 0}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-primary" />
              Buy Extra Slot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">£5.00</div>
            <p className="text-sm text-muted-foreground">
              One-time purchase. Adds a permanent extra character slot to your account.
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Switch between characters any time</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Each character has independent progression</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>VIP benefits apply to all characters on your account</span>
              </div>
            </div>

            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              All players start with <strong>2 character slots</strong> and can purchase more up to 5 total.
            </div>

            {!canBuyMore && currentMax >= 5 && (
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                You've reached the maximum of 5 character slots!
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handlePurchase}
              disabled={purchasing || !canBuyMore}
            >
              {purchasing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
              ) : !canBuyMore ? (
                "Max Slots Reached"
              ) : (
                <>Buy Extra Slot — £5.00</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
