import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gift, MessageSquare, Phone, Send, Skull } from "lucide-react";
import { FriendGiftDialog } from "@/features/relationships/components/FriendGiftDialog";
import { InviteFriendDialog } from "./InviteFriendDialog";
import { UnderworldGiftDialog } from "./UnderworldGiftDialog";

interface Props {
  myProfileId: string;
  otherProfileId: string;
  otherName: string;
  onOpenChat?: () => void;
  onOpenVoice?: () => void;
}

export function FriendActionsBar({
  myProfileId,
  otherProfileId,
  otherName,
  onOpenChat,
  onOpenVoice,
}: Props) {
  const [giftOpen, setGiftOpen] = useState(false);
  const [underworldOpen, setUnderworldOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {onOpenChat && (
          <Button size="sm" variant="outline" onClick={onOpenChat}>
            <MessageSquare className="h-4 w-4 mr-1" /> Chat
          </Button>
        )}
        {onOpenVoice && (
          <Button size="sm" variant="outline" onClick={onOpenVoice}>
            <Phone className="h-4 w-4 mr-1" /> Voice
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
          <Send className="h-4 w-4 mr-1" /> Invite
        </Button>
        <Button size="sm" variant="outline" onClick={() => setGiftOpen(true)}>
          <Gift className="h-4 w-4 mr-1" /> Gift
        </Button>
        <Button size="sm" variant="outline" onClick={() => setUnderworldOpen(true)}>
          <Skull className="h-4 w-4 mr-1" /> Underworld
        </Button>
      </div>

      <FriendGiftDialog
        open={giftOpen}
        onOpenChange={setGiftOpen}
        senderProfileId={myProfileId}
        recipientProfileId={otherProfileId}
        recipientName={otherName}
      />
      <UnderworldGiftDialog
        open={underworldOpen}
        onOpenChange={setUnderworldOpen}
        recipientProfileId={otherProfileId}
        recipientName={otherName}
      />
      <InviteFriendDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        myProfileId={myProfileId}
        otherProfileId={otherProfileId}
        otherDisplayName={otherName}
      />
    </>
  );
}
