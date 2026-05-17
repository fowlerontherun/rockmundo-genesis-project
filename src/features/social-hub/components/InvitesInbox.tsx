import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Inbox, Send, Check, X } from "lucide-react";
import { format } from "date-fns";
import {
  INVITE_KIND_LABELS,
  useIncomingInvites,
  useOutgoingInvites,
  useInviteRealtime,
  useRespondInvite,
  type SocialInviteRow,
  type SocialInviteStatus,
} from "@/hooks/useSocialInvites";

const STATUS_VARIANTS: Record<SocialInviteStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "default",
  accepted: "secondary",
  declined: "destructive",
  expired: "outline",
  cancelled: "outline",
};

function InviteRow({
  invite,
  outgoing,
}: {
  invite: SocialInviteRow;
  outgoing: boolean;
}) {
  const respond = useRespondInvite();
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {INVITE_KIND_LABELS[invite.kind]}
          <Badge variant={STATUS_VARIANTS[invite.status]} className="text-[10px]">
            {invite.status}
          </Badge>
        </div>
        {invite.scheduled_at && (
          <p className="text-xs text-muted-foreground">
            {format(new Date(invite.scheduled_at), "PPp")}
          </p>
        )}
        {invite.message && <p className="mt-1 text-xs">{invite.message}</p>}
      </div>
      {!outgoing && invite.status === "pending" && (
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={() => respond.mutate({ id: invite.id, status: "accepted" })}
            disabled={respond.isPending}
          >
            <Check className="h-3 w-3 mr-1" /> Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => respond.mutate({ id: invite.id, status: "declined" })}
            disabled={respond.isPending}
          >
            <X className="h-3 w-3 mr-1" /> Decline
          </Button>
        </div>
      )}
      {outgoing && invite.status === "pending" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => respond.mutate({ id: invite.id, status: "cancelled" })}
          disabled={respond.isPending}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}

export function InvitesInbox({ profileId }: { profileId: string | null | undefined }) {
  useInviteRealtime(profileId);
  const incoming = useIncomingInvites(profileId);
  const outgoing = useOutgoingInvites(profileId);

  const incomingPending = useMemo(
    () => (incoming.data ?? []).filter((i) => i.status === "pending"),
    [incoming.data],
  );
  const incomingPast = useMemo(
    () => (incoming.data ?? []).filter((i) => i.status !== "pending"),
    [incoming.data],
  );

  if (incoming.isLoading || outgoing.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading invites…
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4" /> Incoming
          </CardTitle>
          <CardDescription>Invites others have sent you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {incomingPending.length === 0 && incomingPast.length === 0 && (
            <p className="text-sm text-muted-foreground">No invites yet.</p>
          )}
          {incomingPending.map((i) => (
            <InviteRow key={i.id} invite={i} outgoing={false} />
          ))}
          {incomingPast.slice(0, 5).map((i) => (
            <InviteRow key={i.id} invite={i} outgoing={false} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" /> Sent
          </CardTitle>
          <CardDescription>Invites you've sent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(outgoing.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">You haven't sent any invites yet.</p>
          )}
          {(outgoing.data ?? []).slice(0, 10).map((i) => (
            <InviteRow key={i.id} invite={i} outgoing={true} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
