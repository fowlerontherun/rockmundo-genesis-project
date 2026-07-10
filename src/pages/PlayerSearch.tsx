import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, User, Music, Star, MapPin, Clock, Users, UserPlus, MessageSquare, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useGameData } from "@/hooks/useGameData";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { resolveRelationshipPairKey } from "@/features/relationships/api";
import { DirectMessagePanel } from "@/features/relationships/components/DirectMessagePanel";
import { useToast } from "@/hooks/use-toast";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { searchPublicProfiles, type PublicProfileSearchResult } from "@/services/publicProfileSearch";

type PlayerProfile = PublicProfileSearchResult;
type FriendState = "none" | "friends" | "pending_sent" | "pending_received";

export default function PlayerSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dmTarget, setDmTarget] = useState<{ profileId: string; displayName: string } | null>(null);
  const { profile } = useGameData();
  const { friendships, sendRequest, acceptRequest } = useFriendships(profile?.id);
  const { toast } = useToast();

  const { data: players, isLoading, isError, error } = useQuery({
    queryKey: ["player-search", debouncedQuery, profile?.id],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];

      return searchPublicProfiles(debouncedQuery, profile?.id);
    },
    enabled: debouncedQuery.length >= 2,
  });

  const friendStateMap = useMemo(() => {
    const map = new Map<string, { state: FriendState; friendshipId: string }>();
    if (!profile?.id) return map;
    for (const f of friendships) {
      const otherId = f.otherProfile?.id;
      if (!otherId) continue;
      if (f.friendship.status === "accepted") {
        map.set(otherId, { state: "friends", friendshipId: f.friendship.id });
      } else if (f.friendship.status === "pending") {
        map.set(otherId, {
          state: f.isRequester ? "pending_sent" : "pending_received",
          friendshipId: f.friendship.id,
        });
      }
    }
    return map;
  }, [friendships, profile?.id]);

  const handleSearch = () => {
    setDebouncedQuery(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSendRequest = async (targetProfileId: string) => {
    try {
      await sendRequest(targetProfileId);
      toast({ title: "Friend request sent!" });
    } catch {
      toast({ title: "Failed to send request", variant: "destructive" });
    }
  };

  const handleAccept = async (friendshipId: string) => {
    try {
      await acceptRequest(friendshipId);
      toast({ title: "Friend request accepted!" });
    } catch {
      toast({ title: "Failed to accept request", variant: "destructive" });
    }
  };

  const getFriendState = (playerId: string): { state: FriendState; friendshipId: string } => {
    return friendStateMap.get(playerId) ?? { state: "none", friendshipId: "" };
  };

  return (
    <FMPageScaffold
      title="Search Players"
      subtitle="Find other musicians and view their profiles"
      icon={Search}
      backTo="/hub/world-social"
    >


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Player Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by username or display name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <Button onClick={handleSearch} disabled={searchQuery.length < 2}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground" aria-live="polite">Searching public-safe musician profiles...</p>
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card role="alert">
          <CardContent className="p-6">
            <p className="text-center text-destructive">
              {error instanceof Error ? error.message : "Player search is unavailable right now. Please try again."}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && debouncedQuery.length >= 2 && players && players.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">No players found matching your search.</p>
          </CardContent>
        </Card>
      )}

      {!isError && players && players.length > 0 && (
        <div className="space-y-3">
          {players.map((player) => {
            const isSelf = profile?.id === player.id;
            const { state: friendState, friendshipId } = getFriendState(player.id);

            return (
              <Card key={player.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={player.avatar_url || undefined} />
                      <AvatarFallback>
                        <User className="h-7 w-7" />
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">
                          {player.display_name || player.username}
                        </span>
                        {player.display_name && (
                          <span className="text-sm text-muted-foreground">
                            @{player.username}
                          </span>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {player.fame.toLocaleString()} Fame
                        </Badge>
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Music className="h-3 w-3" />
                          Level {player.level}
                        </Badge>
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {player.fans.toLocaleString()} Fans
                        </Badge>
                        {player.city_name && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {player.city_name}
                          </Badge>
                        )}
                      </div>

                      {player.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{player.bio}</p>
                      )}

                      {player.bands && player.bands.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {player.bands.map((band, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              <Music className="mr-1 h-3 w-3" />
                              {band.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border">
                    <Link to={`/player/${player.id}`}>
                      <Button variant="outline" size="sm">
                        View Profile
                      </Button>
                    </Link>

                    {!isSelf && profile?.id && (
                      <>
                        {friendState === "none" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendRequest(player.id)}
                          >
                            <UserPlus className="mr-1 h-4 w-4" />
                            Add Friend
                          </Button>
                        )}
                        {friendState === "pending_sent" && (
                          <Button variant="outline" size="sm" disabled>
                            <Clock className="mr-1 h-4 w-4" />
                            Request Sent
                          </Button>
                        )}
                        {friendState === "pending_received" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAccept(friendshipId)}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Accept
                          </Button>
                        )}
                        {friendState === "friends" && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="mr-1 h-3 w-3" /> Friends
                          </Badge>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDmTarget({
                            profileId: player.id,
                            displayName: player.display_name || player.username,
                          })}
                        >
                          <MessageSquare className="mr-1 h-4 w-4" />
                          Message
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* DM Dialog */}
      <Dialog open={!!dmTarget} onOpenChange={(open) => !open && setDmTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Message {dmTarget?.displayName}</DialogTitle>
          </DialogHeader>
          {dmTarget && profile?.id && (
            <DirectMessagePanel
              channel={`dm:${resolveRelationshipPairKey(profile.id, dmTarget.profileId)}`}
              currentUserId={profile.user_id}
              otherDisplayName={dmTarget.displayName}
            />
          )}
        </DialogContent>
      </Dialog>
    </FMPageScaffold>
  );
}
