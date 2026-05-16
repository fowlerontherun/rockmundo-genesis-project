import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gift } from "lucide-react";
import { GIFT_CATALOG, useSendFriendGift } from "@/hooks/useFriendGifts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  senderProfileId: string;
  recipientProfileId: string;
  recipientName: string;
}

export function FriendGiftDialog({ open, onOpenChange, senderProfileId, recipientProfileId, recipientName }: Props) {
  const [giftType, setGiftType] = useState<string>(GIFT_CATALOG[0].value);
  const [message, setMessage] = useState("");
  const send = useSendFriendGift();
  const cfg = GIFT_CATALOG.find((g) => g.value === giftType)!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-social-loyalty" /> Send a gift to {recipientName}</DialogTitle>
          <DialogDescription>Boost affection. Gifts cost cash and can only be sent so often.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Gift</Label>
            <Select value={giftType} onValueChange={setGiftType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GIFT_CATALOG.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label} — ${(g.costCents / 100).toLocaleString()} (+{g.affection} affection)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Message (optional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="A short note…" maxLength={140} />
          </div>
          <div className="text-xs text-muted-foreground">
            Cost ${(cfg.costCents / 100).toLocaleString()} · +{cfg.affection} affection
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={send.isPending}
            onClick={() => send.mutate(
              { senderProfileId, recipientProfileId, giftType, message },
              { onSuccess: () => onOpenChange(false) }
            )}
          >Send gift</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
