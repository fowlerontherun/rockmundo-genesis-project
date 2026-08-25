import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, MessageSquare, Music, User, UserRoundPlus } from "lucide-react";
import { PresenceIndicator } from "@/components/presence/PresenceIndicator";
import { DirectMessagePanel } from "@/features/relationships/components/DirectMessagePanel";
import { resolveRelationshipPairKey } from "@/features/relationships/api";
import { INVITE_KIND_LABELS, type SocialInviteKind, useCreateInvite } from "@/hooks/useSocialInvites";
import { useActiveProfile } from "@/hooks/useActiveProfile";

interface PlayerProfileHeaderProps {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  cityName?: string | null;
  currentBand?: { id: string; name: string } | null;
  mainRole?: string | null;
  fame?: number | null;
  careerLevel?: number | null;
  presence?: any;
  isOwnProfile?: boolean;
  actions?: React.ReactNode;
}

export function PlayerProfileHeader({ name, username, avatarUrl, cityName, currentBand, mainRole, fame, careerLevel, presence, isOwnProfile, actions }: PlayerProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm md:flex-row md:items-start md:p-6">
      <Avatar className="h-24 w-24 border-2 border-primary/30">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold">{name}</h1>
              {presence && <PresenceIndicator state={presence} />}
              {isOwnProfile && <Badge variant="secondary">Your profile</Badge>}
            </div>
            {username && username !== name && <p className="text-sm text-muted-foreground">@{username}</p>}
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {currentBand && <Link to={`/band/${currentBand.id}`} className="inline-flex items-center gap-1 hover:underline"><Music className="h-3 w-3" />{currentBand.name}</Link>}
          {mainRole && <Badge variant="outline">{mainRole}</Badge>}
          {careerLevel != null && <Badge variant="outline">Career level {careerLevel}</Badge>}
          {fame != null && <Badge variant="outline">Fame {fame.toLocaleString()}</Badge>}
          {cityName && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{cityName}</span>}
        </div>
      </div>
    </div>
  );
}

const INVITE_KINDS = Object.keys(INVITE_KIND_LABELS) as SocialInviteKind[];

export function FutureProfileActions() {
  const location = useLocation();
  const { profileId, userId } = useActiveProfile();
  const createInvite = useCreateInvite();
  const [messageOpen, setMessageOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const targetProfileId = location.pathname.match(/\/player\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const canInteract = Boolean(profileId && userId && targetProfileId && targetProfileId !== profileId);
  const channel = canInteract ? `dm:${resolveRelationshipPairKey(profileId!, targetProfileId!)}` : null;

  const sendInvite = async (kind: SocialInviteKind) => {
    if (!targetProfileId) return;
    await createInvite.mutateAsync({ to_profile_id: targetProfileId, kind });
    setInviteOpen(false);
  };

  if (!canInteract) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setMessageOpen(true)}>
        <MessageSquare className="mr-1 h-4 w-4" /> Message
      </Button>
      <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
        <UserRoundPlus className="mr-1 h-4 w-4" /> Invite to activity
      </Button>

      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Direct message</DialogTitle></DialogHeader>
          {channel && userId && (
            <DirectMessagePanel channel={channel} currentUserId={userId} otherDisplayName="Player" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite to activity</DialogTitle></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {INVITE_KINDS.map((kind) => (
              <Button
                key={kind}
                variant="outline"
                onClick={() => void sendInvite(kind)}
                disabled={createInvite.isPending}
              >
                {INVITE_KIND_LABELS[kind]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
