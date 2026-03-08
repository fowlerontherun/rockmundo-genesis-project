import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Crown, ShieldCheck, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { useVipStatus } from "@/hooks/useVipStatus";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export default function BuyCharacterSlot() {
  const { slots, slotsLoading, characters } = useCharacterSlots();
  const { data: vipStatus } = useVipStatus();
  const [purchasing, setPurchasing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const maxPossible = vipStatus?.isVip ? 5 : 2;
  const currentMax = slots?.maxSlots ?? 1;
  const canBuyMore = currentMax < maxPossible;

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

  return (
    <PageLayout>
      <PageHeader title="Character Slots" subtitle="Expand your roster with additional character slots." />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Slots Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Your Slots
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {slotsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-bold">{slots?.usedSlots ?? 0} / {currentMax}</span>
                </div>
                <Progress value={((slots?.usedSlots ?? 0) / currentMax) * 100} />

                <div className="space-y-2 pt-2">
                  {characters.map((char) => (
                    <div key={char.id} className="flex items-center gap-2 text-sm rounded-md border p-2">
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {(char.display_name || char.username || "?")[0]?.toUpperCase()}
                      </div>
                      <span className="truncate flex-1">{char.display_name || char.username || "Unnamed"}</span>
                      <Badge variant="outline" className="text-[10px]">Lv.{char.level}</Badge>
                      {char.is_active && <Badge className="text-[10px] bg-primary/20 text-primary">Active</Badge>}
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground pt-2">
                  Extra slots purchased: {slots?.extraSlotsPurchased ?? 0}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Purchase Card */}
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
                <span>Run multiple characters simultaneously</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Each character has independent progress</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Switch between characters anytime</span>
              </div>
            </div>

            {!vipStatus?.isVip && (
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <Crown className="h-3.5 w-3.5 inline mr-1 text-yellow-500" />
                Free players can have up to 2 slots. <strong>VIP members</strong> can expand up to 5.
              </div>
            )}

            {vipStatus?.isVip && currentMax >= 5 && (
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                You've reached the maximum of 5 character slots!
              </div>
            )}

            {!canBuyMore && !vipStatus?.isVip && currentMax >= 2 && (
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <Crown className="h-3.5 w-3.5 inline mr-1 text-yellow-500" />
                Upgrade to <strong>VIP</strong> to unlock up to 5 slots.
                <Button variant="link" size="sm" className="p-0 h-auto ml-1" onClick={() => navigate("/vip-subscribe")}>
                  Learn more
                </Button>
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
