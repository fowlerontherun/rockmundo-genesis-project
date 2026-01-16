import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { DecoratedFriendship } from "../types";
import { UserPlus, UserX, Loader2 } from "lucide-react";

interface FriendshipListProps {
  friendships: DecoratedFriendship[];
  loading: boolean;
  onSelect: (friend: DecoratedFriendship) => void;
  selectedFriendshipId: string | null;
  onAccept: (friendshipId: string) => void;
  onDecline: (friendshipId: string) => void;
  onRemove: (friendshipId: string) => void;
}

export function FriendshipList({
  friendships,
  loading,
  onSelect,
  selectedFriendshipId,
  onAccept,
  onDecline,
  onRemove,
}: FriendshipListProps) {
  const { incoming, outgoing, accepted } = useMemo(() => {
    const grouped = {
      incoming: [] as DecoratedFriendship[],
      outgoing: [] as DecoratedFriendship[],
      accepted: [] as DecoratedFriendship[],
    };

    friendships.forEach((friendship) => {
      if (friendship.friendship.status === "accepted") {
        grouped.accepted.push(friendship);
        return;
      }

      if (friendship.friendship.status === "pending") {
        if (friendship.isRequester) {
          grouped.outgoing.push(friendship);
        } else {
          grouped.incoming.push(friendship);
        }
        return;
      }

      grouped.accepted.push(friendship);
    });

    return grouped;
  }, [friendships]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Relationships</CardTitle>
        <CardDescription>Manage requests and choose a friend to review in-depth.</CardDescription>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-4">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading friends
          </div>
        ) : (
          <ScrollArea className="h-[520px] pr-4">
            <div className="space-y-6">
              {incoming.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Incoming requests
                  </p>
                  <div className="space-y-3">
                    {incoming.map((friendship) => (
                      <FriendRow
                        key={friendship.friendship.id}
                        friendship={friendship}
                        onSelect={onSelect}
                        selected={selectedFriendshipId === friendship.friendship.id}
                        actions={
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => onAccept(friendship.friendship.id)}>
                              <UserPlus className="mr-1 h-4 w-4" /> Accept
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onDecline(friendship.friendship.id)}>
                              <UserX className="mr-1 h-4 w-4" /> Decline
                            </Button>
                          </div>
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {outgoing.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pending approvals
                  </p>
                  <div className="space-y-3">
                    {outgoing.map((friendship) => (
                      <FriendRow
                        key={friendship.friendship.id}
                        friendship={friendship}
                        onSelect={onSelect}
                        selected={selectedFriendshipId === friendship.friendship.id}
                        actions={
                          <Button size="sm" variant="outline" onClick={() => onRemove(friendship.friendship.id)}>
                            Cancel request
                          </Button>
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Friends
                </p>
                {accepted.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active friendships yet.</p>
                ) : (
                  <div className="space-y-3">
                    {accepted.map((friendship) => (
                      <FriendRow
                        key={friendship.friendship.id}
                        friendship={friendship}
                        onSelect={onSelect}
                        selected={selectedFriendshipId === friendship.friendship.id}
                        actions={
                          <Button size="sm" variant="outline" onClick={() => onRemove(friendship.friendship.id)}>
                            Remove
                          </Button>
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

interface FriendRowProps {
  friendship: DecoratedFriendship;
  selected: boolean;
  onSelect: (friend: DecoratedFriendship) => void;
  actions?: React.ReactNode;
}

function FriendRow({ friendship, selected, onSelect, actions }: FriendRowProps) {
  const profile = friendship.otherProfile;

  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition hover:border-primary ${
        selected ? "border-primary bg-primary/5" : "border-muted"
      }`}
      onClick={() => onSelect(friendship)}
    >
      <div className="flex flex-1 items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.display_name ?? profile?.username} />
          <AvatarFallback>{profile?.display_name?.[0] ?? profile?.username?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold">{profile?.display_name ?? profile?.username ?? "Unknown artist"}</p>
          <p className="text-xs text-muted-foreground">
            Level {profile?.level ?? 1} • Fame {profile?.fame?.toLocaleString() ?? 0}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs capitalize">
          {friendship.friendship.status}
        </Badge>
        {actions}
      </div>
    </button>
  );
}

