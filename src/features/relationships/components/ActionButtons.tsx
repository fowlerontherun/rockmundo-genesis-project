import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Handshake, Gift, PartyPopper, Sparkles, ShieldCheck, UsersRound, Music2, Mic2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { executeRelationshipAction } from "@/hooks/useRelationshipRewards";
import { RELATIONSHIP_ACTION_REWARDS, type ActionRewardConfig } from "../rewardsConfig";
import { RewardChip } from "./RewardChip";
import { recordRelationshipEvent } from "../api";

interface ActionButtonsProps {
  profileId: string;
  userId: string;
  otherProfileId: string;
  otherUserId?: string | null;
  otherDisplayName: string;
  onEventRecorded: () => void;
}

type ActiveDialog =
  | { type: "gift" }
  | { type: "trade" }
  | { type: "collab" }
  | { type: "hangout" }
  | { type: "permissions" }
  | null;

const QUICK_BUTTONS: Array<{ id: string; icon: typeof Gift; reward: ActionRewardConfig; dialogType?: ActiveDialog["type"] }> = [
  { id: "chat",        icon: PartyPopper, reward: RELATIONSHIP_ACTION_REWARDS.chat },
  { id: "gift",        icon: Gift,        reward: RELATIONSHIP_ACTION_REWARDS.gift,        dialogType: "gift" },
  { id: "hangout",     icon: UsersRound,  reward: RELATIONSHIP_ACTION_REWARDS.hangout,     dialogType: "hangout" },
  { id: "trade",       icon: Handshake,   reward: RELATIONSHIP_ACTION_REWARDS.trade,       dialogType: "trade" },
  { id: "jam",         icon: Music2,      reward: RELATIONSHIP_ACTION_REWARDS.jam },
  { id: "gig",         icon: Mic2,        reward: RELATIONSHIP_ACTION_REWARDS.gig },
  { id: "songwriting", icon: Sparkles,    reward: RELATIONSHIP_ACTION_REWARDS.songwriting },
];

export function QuickActionButtons({
  profileId,
  userId,
  otherProfileId,
  otherUserId,
  otherDisplayName,
  onEventRecorded,
}: ActionButtonsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [amount, setAmount] = useState("100");
  const [notes, setNotes] = useState("");
  const [selectedTradeGearId, setSelectedTradeGearId] = useState("");
  const [tradeGearOptions, setTradeGearOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (activeDialog?.type !== "trade" || !user?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("player_equipment_inventory")
        .select("id, equipment:equipment_items!equipment_id(name)")
        .eq("user_id", user.id)
        .eq("is_equipped", false)
        .limit(50);
      setTradeGearOptions(
        (data ?? []).map((d: any) => ({ id: d.id, name: d.equipment?.name ?? "Unknown gear" })),
      );
    })();
  }, [activeDialog?.type, user?.id]);

  const closeDialog = () => {
    setActiveDialog(null);
    setNotes("");
    setAmount("100");
  };

  const runAction = async (
    actionId: string,
    message?: string,
    metadata?: Record<string, unknown>,
  ) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const result = await executeRelationshipAction({
        action: actionId,
        profileId,
        otherProfileId,
        message: message ?? `${RELATIONSHIP_ACTION_REWARDS[actionId]?.label ?? actionId} with ${otherDisplayName}`,
        metadata,
      });

      if (!result.success) {
        toast({
          title: "Couldn't complete action",
          description: result.error ?? "Something went wrong.",
          variant: "destructive",
        });
        return;
      }

      const cfg = RELATIONSHIP_ACTION_REWARDS[actionId];
      const skillPart = result.skill_xp_awarded
        ? ` · +${result.skill_xp_awarded} ${cfg?.skillLabel ?? "Skill"} XP`
        : "";
      const streakPart = result.streak_bonus
        ? ` · 🔥 ${result.streak_bonus.label} +${result.streak_bonus.xp} XP`
        : result.streak_days
        ? ` · 🔥 ${result.streak_days}-day streak`
        : "";
      const capPart = result.cap_remaining !== undefined
        ? ` · ${result.cap_remaining} left today`
        : "";

      toast({
        title: `+${result.xp_awarded ?? 0} XP${skillPart}`,
        description: `${result.action_label ?? cfg?.label ?? "Action"}${streakPart}${capPart}`,
      });

      queryClient.invalidateQueries({ queryKey: ["social-streak"] });
      queryClient.invalidateQueries({ queryKey: ["friend-rewards"] });
      queryClient.invalidateQueries({ queryKey: ["progression-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["skill-progress"] });

      onEventRecorded();
      closeDialog();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleGiftSubmit = async () => {
    const giftAmount = Number(amount) || 0;
    await runAction("gift", `Sent ${giftAmount} credits to ${otherDisplayName}`, {
      gift_amount: giftAmount,
      gift_reason: notes || "Friendship boost",
    });
  };

  const handleTradeSubmit = async () => {
    if (!selectedTradeGearId || !otherUserId || !user?.id) {
      toast({ title: "Select gear to trade", variant: "destructive" });
      return;
    }
    setIsBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("player_equipment_inventory")
        .update({ user_id: otherUserId, is_equipped: false })
        .eq("id", selectedTradeGearId)
        .eq("user_id", user.id);
      if (error) throw error;
      const itemName = tradeGearOptions.find((g) => g.id === selectedTradeGearId)?.name ?? "gear";
      setSelectedTradeGearId("");
      await runAction("trade", `Sent ${itemName} to ${otherDisplayName}`, {
        trade_item: itemName,
        trade_notes: notes,
      });
    } catch (err: any) {
      toast({ title: "Trade failed", description: err.message, variant: "destructive" });
      setIsBusy(false);
    }
  };

  const handleHangout = async () => {
    await runAction("hangout", `Scheduled a hangout with ${otherDisplayName}`, { hangout_notes: notes });
  };

  const handlePermissions = async () => {
    try {
      await recordRelationshipEvent({
        userId,
        profileId,
        otherProfileId,
        otherUserId,
        activityType: "relationship_permission_update",
        message: `Adjusted trust settings for ${otherDisplayName}`,
      });
      toast({ title: "Trust settings saved" });
      onEventRecorded();
      closeDialog();
    } catch (err) {
      toast({
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {QUICK_BUTTONS.map((btn) => {
          const Icon = btn.icon;
          return (
            <Button
              key={btn.id}
              variant="secondary"
              className="h-auto justify-start py-2 text-left"
              disabled={isBusy}
              onClick={() => {
                if (btn.dialogType) setActiveDialog({ type: btn.dialogType } as ActiveDialog);
                else void runAction(btn.id);
              }}
            >
              <Icon className="mr-2 h-4 w-4 shrink-0" />
              <div className="flex flex-1 flex-col items-start gap-1">
                <span className="text-sm">{btn.reward.label}</span>
                <RewardChip reward={btn.reward} />
              </div>
            </Button>
          );
        })}
        <Button
          variant="ghost"
          className="h-auto justify-start py-2"
          onClick={() => setActiveDialog({ type: "permissions" })}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          <span className="text-sm">Manage trust</span>
        </Button>
      </div>

      <Dialog open={activeDialog?.type === "gift"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a gift</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={1} />
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note" />
          </div>
          <DialogFooter>
            <Button onClick={handleGiftSubmit} disabled={isBusy}>Send gift (+5 XP, +3 Charisma)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog?.type === "trade"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trade gear with {otherDisplayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedTradeGearId} onValueChange={setSelectedTradeGearId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose unequipped gear" />
              </SelectTrigger>
              <SelectContent>
                {tradeGearOptions.length === 0 ? (
                  <SelectItem value="none" disabled>No unequipped gear available</SelectItem>
                ) : (
                  tradeGearOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note (optional)" />
          </div>
          <DialogFooter>
            <Button onClick={handleTradeSubmit} disabled={isBusy || !selectedTradeGearId}>
              {isBusy ? "Sending..." : "Confirm trade (+10 XP, +5 Business)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog?.type === "hangout"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plan a hangout</DialogTitle>
          </DialogHeader>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where, when, etc." />
          <DialogFooter>
            <Button onClick={handleHangout} disabled={isBusy}>Schedule hangout (+8 XP, +5 Charisma)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog?.type === "permissions"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage trust permissions</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Share backstage access, enable joint purchases, or grant asset lending rights.
          </p>
          <DialogFooter>
            <Button onClick={handlePermissions}>Save preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
