import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INVITE_KIND_LABELS,
  useCreateInvite,
  type SocialInviteKind,
} from "@/hooks/useSocialInvites";

const KIND_DESCRIPTIONS: Record<SocialInviteKind, string> = {
  gig: "Invite them to attend or perform with you at one of your gigs.",
  recording: "Bring them into the studio for a recording session.",
  jam: "Drop into a jam session together.",
  songwriting: "Co-write a song.",
  meetup: "Catch up in person — coffee, drinks, hangout.",
  date: "Romantic date. Builds attraction over time.",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  myProfileId: string;
  otherProfileId: string;
  otherDisplayName: string;
  defaultKind?: SocialInviteKind;
}

export function InviteFriendDialog({
  open,
  onOpenChange,
  myProfileId,
  otherProfileId,
  otherDisplayName,
  defaultKind = "meetup",
}: Props) {
  const [kind, setKind] = useState<SocialInviteKind>(defaultKind);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [message, setMessage] = useState("");
  const create = useCreateInvite();

  const submit = () => {
    create.mutate(
      {
        from_profile_id: myProfileId,
        to_profile_id: otherProfileId,
        kind,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        message: message.trim() || null,
      },
      {
        onSuccess: () => {
          setMessage("");
          setScheduledAt("");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite {otherDisplayName}</DialogTitle>
          <DialogDescription>{KIND_DESCRIPTIONS[kind]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>What kind of invite?</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as SocialInviteKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(INVITE_KIND_LABELS) as SocialInviteKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {INVITE_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>When?</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div>
            <Label>Message (optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="A short note…"
              maxLength={280}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
