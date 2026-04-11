import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { recordRelationshipEvent } from "../api";
import { Handshake, Gift, PartyPopper, Sparkles, ShieldCheck, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useAuth } from "@/hooks/use-auth-context";

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
  | { type: "collab"; collabType: string | null }
  | { type: "hangout" }
  | { type: "permissions" }
  | null;

export function QuickActionButtons({
  profileId,
  userId,
  otherProfileId,
  otherUserId,
  otherDisplayName,
  onEventRecorded,
}: ActionButtonsProps) {
  const { toast } = useToast();
  const { profileId: currentProfileId } = useActiveProfile();
  const { user } = useAuth();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [amount, setAmount] = useState("100");
  const [notes, setNotes] = useState("");
  const [selectedTradeGearId, setSelectedTradeGearId] = useState("");
  const [tradeGearOptions, setTradeGearOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [isTrading, setIsTrading] = useState(false);

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
        (data ?? []).map((d: any) => ({ id: d.id, name: d.equipment?.name ?? "Unknown gear" }))
      );
    })();
  }, [activeDialog?.type, user?.id]);

  const closeDialog = () => {
    setActiveDialog(null);
    setNotes("");
    setAmount("100");
  };

  const recordEvent = async (
    activityType: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) => {
    try {
      await recordRelationshipEvent({
        userId,
        profileId,
        otherProfileId,
        otherUserId,
        activityType,
        message,
        metadata,
      });
      toast({ title: "Action completed", description: "Your friendship gained affinity." });
      onEventRecorded();
      closeDialog();
    } catch (error: unknown) {
      toast({
        title: "Unable to complete action",
        description: error instanceof Error ? error.message : "Something went wrong while recording the action.",
        variant: "destructive",
      });
    }
  };

  const handleGiftSubmit = async () => {
    const giftAmount = Number(amount) || 0;
    await recordEvent("relationship_gift", `Sent ${giftAmount} credits to ${otherDisplayName}`, {
      gift_amount: giftAmount,
      gift_reason: notes || "Friendship boost",
    });
  };

  const handleTradeSubmit = async () => {
    if (!selectedTradeGearId || !otherUserId || !user?.id) {
      toast({ title: "Select gear to trade", variant: "destructive" });
      return;
    }
    setIsTrading(true);
    try {
      const { error } = await (supabase as any)
        .from("player_equipment_inventory")
        .update({ user_id: otherUserId, is_equipped: false })
        .eq("id", selectedTradeGearId)
        .eq("user_id", user.id);
      if (error) throw error;
      const itemName = tradeGearOptions.find(g => g.id === selectedTradeGearId)?.name ?? "gear";
      await recordEvent("relationship_trade", `Sent ${itemName} to ${otherDisplayName}`, {
        trade_item: itemName,
        trade_notes: notes,
      });
      setSelectedTradeGearId("");
    } catch (err: any) {
      toast({ title: "Trade failed", description: err.message, variant: "destructive" });
    } finally {
      setIsTrading(false);
    }
  };

  const handleCollab = async (collabType: string) => {
    await recordEvent(
      collabType === "jam" ? "relationship_jam" : collabType === "gig" ? "relationship_gig" : "relationship_collab",
      `Planned a ${collabType} with ${otherDisplayName}`,
      { collaboration_type: collabType, collaboration_notes: notes },
    );
  };

  const handleHangout = async () => {
    await recordEvent("relationship_group_chat", `Scheduled a hangout with ${otherDisplayName}`, {
      hangout_notes: notes,
    });
  };

  const handlePermissions = async () => {
    await recordEvent("relationship_permission_update", `Adjusted trust settings for ${otherDisplayName}`);
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Button variant="secondary" className="justify-start" onClick={() => setActiveDialog({ type: "gift" })}>
        <Gift className="mr-2 h-4 w-4" /> Send gift
      </Button>
      <Button variant="secondary" className="justify-start" onClick={() => setActiveDialog({ type: "trade" })}>
        <Handshake className="mr-2 h-4 w-4" /> Secure trade
      </Button>
      <Button variant="secondary" className="justify-start" onClick={() => setActiveDialog({ type: "collab", collabType: null })}>
        <Sparkles className="mr-2 h-4 w-4" /> Launch collab
      </Button>
      <Button variant="secondary" className="justify-start" onClick={() => setActiveDialog({ type: "hangout" })}>
        <UsersRound className="mr-2 h-4 w-4" /> Plan hangout
      </Button>
      <Button variant="secondary" className="justify-start" onClick={() => setActiveDialog({ type: "permissions" })}>
        <ShieldCheck className="mr-2 h-4 w-4" /> Manage trust
      </Button>
      <Button
        variant="secondary"
        className="justify-start"
        onClick={() => recordEvent("relationship_chat", `Checked in with ${otherDisplayName}`)}
      >
        <PartyPopper className="mr-2 h-4 w-4" /> Send quick ping
      </Button>

      <Dialog open={activeDialog?.type === "gift"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a gift</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min={1} />
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add a note"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleGiftSubmit}>Send gift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog?.type === "trade"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trade gear with {otherDisplayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium mb-1">Select gear to send</p>
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
            </div>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add a note (optional)"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleTradeSubmit} disabled={isTrading || !selectedTradeGearId}>
              {isTrading ? "Sending..." : "Confirm trade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog?.type === "collab"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch a collaboration</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Button variant="outline" onClick={() => handleCollab("jam")}>Jam Session</Button>
            <Button variant="outline" onClick={() => handleCollab("gig")}>Gig Performance</Button>
            <Button variant="outline" onClick={() => handleCollab("songwriting")}>Songwriting Sprint</Button>
          </div>
          <Textarea
            className="mt-3"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes or goals"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog?.type === "hangout"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plan a hangout</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Where are you meeting? Add any timing details."
          />
          <DialogFooter>
            <Button onClick={handleHangout}>Schedule hangout</Button>
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

