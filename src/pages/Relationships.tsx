import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { FriendshipList } from "@/features/relationships/components/FriendshipList";
import { FriendDetailPanel } from "@/features/relationships/components/FriendDetailPanel";
import { FriendSearchDialog } from "@/features/relationships/components/FriendSearchDialog";
import { useRelationshipEvents } from "@/features/relationships/hooks/useRelationshipEvents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, HeartHandshake, Sparkles } from "lucide-react";

export default function RelationshipsPage() {
  const { user } = useAuth();
  const { profile } = useGameData();
  const { toast } = useToast();
  const { friendships, loading, acceptRequest, declineRequest, removeFriend, sendRequest } = useFriendships(
    profile?.id,
  );
  const [selectedFriendshipId, setSelectedFriendshipId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const selectedFriendship = useMemo(
    () => friendships.find((friend) => friend.friendship.id === selectedFriendshipId) ?? null,
    [friendships, selectedFriendshipId],
  );

  const excludeProfileIds = useMemo(() => {
    const ids = new Set<string>();
    if (profile?.id) {
      ids.add(profile.id);
    }
    friendships.forEach((friend) => {
      if (friend.otherProfile?.id) {
        ids.add(friend.otherProfile.id);
      }
    });
    return Array.from(ids);
  }, [profile?.id, friendships]);

  useEffect(() => {
    if (selectedFriendshipId) {
      const stillExists = friendships.some((friend) => friend.friendship.id === selectedFriendshipId);
      if (!stillExists) {
        setSelectedFriendshipId(friendships[0]?.friendship.id ?? null);
      }
      return;
    }

    if (friendships.length > 0) {
      const firstAccepted = friendships.find((friend) => friend.friendship.status === "accepted");
      setSelectedFriendshipId(firstAccepted?.friendship.id ?? friendships[0]?.friendship.id ?? null);
    }
  }, [friendships, selectedFriendshipId]);

  const { events, summary, refetch: refetchEvents } = useRelationshipEvents({
    profileId: profile?.id ?? null,
    otherProfileId: selectedFriendship?.otherProfile?.id ?? null,
    userIds: [user?.id ?? null, selectedFriendship?.otherProfile?.user_id ?? null],
    enabled: Boolean(selectedFriendship),
  });

  const resolveErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

  const handleSendRequest = async (targetProfileId: string) => {
    if (!profile?.id) {
      throw new Error("You need a profile before sending requests");
    }
    await sendRequest(targetProfileId);
  };

  const totalAccepted = friendships.filter((friend) => friend.friendship.status === "accepted").length;
  const pendingCount = friendships.filter((friend) => friend.friendship.status === "pending").length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Relationships</h1>
          <p className="text-muted-foreground max-w-2xl">
            Build friendships, track affinity, and collaborate with other players.
          </p>
        </div>
        <Button onClick={() => setSearchOpen(true)}>Find friends</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr),minmax(0,1.15fr)]">
        <FriendshipList
          friendships={friendships}
          loading={loading}
          onSelect={(friendship) => setSelectedFriendshipId(friendship.friendship.id)}
          selectedFriendshipId={selectedFriendshipId}
          onAccept={(id) => acceptRequest(id).catch((error: unknown) => {
            toast({
              title: "Unable to accept request",
              description: resolveErrorMessage(error),
              variant: "destructive",
            });
          })}
          onDecline={(id) => declineRequest(id).catch((error: unknown) => {
            toast({
              title: "Unable to decline request",
              description: resolveErrorMessage(error),
              variant: "destructive",
            });
          })}
          onRemove={(id) => removeFriend(id).catch((error: unknown) => {
            toast({
              title: "Unable to modify friendship",
              description: resolveErrorMessage(error),
              variant: "destructive",
            });
          })}
        />
        <FriendDetailPanel
          friendship={selectedFriendship}
          summary={summary}
          events={events}
          currentProfileId={profile?.id ?? ""}
          currentUserId={user?.id ?? null}
          onRefreshEvents={refetchEvents}
        />
      </div>

      <FriendSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        excludeProfileIds={excludeProfileIds}
        onSelectProfile={handleSendRequest}
      />
    </div>
  );
}

