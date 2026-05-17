import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare } from "lucide-react";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { DirectMessageThread } from "./DirectMessageThread";

export function MessagesTab({ myProfileId }: { myProfileId: string | null | undefined }) {
  const { friendships, loading } = useFriendships(myProfileId ?? null);
  const accepted = useMemo(
    () => friendships.filter((f) => f.friendship.status === "accepted" && f.otherProfile),
    [friendships],
  );
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const active = accepted.find((f) => f.otherProfile?.id === activeFriendId);

  if (!myProfileId) {
    return <p className="text-sm text-muted-foreground">Sign in to view your conversations.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-[260px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Conversations
          </CardTitle>
          <CardDescription className="text-xs">Pick a friend to chat with.</CardDescription>
        </CardHeader>
        <CardContent className="p-2">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : accepted.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              Add some friends from the Discover tab to start chatting.
            </p>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="space-y-1">
                {accepted.map((f) => {
                  const other = f.otherProfile!;
                  const isActive = activeFriendId === other.id;
                  return (
                    <Button
                      key={f.friendship.id}
                      variant={isActive ? "secondary" : "ghost"}
                      className="w-full justify-start gap-2 px-2"
                      onClick={() => setActiveFriendId(other.id)}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={(other as any).avatar_url ?? undefined} />
                        <AvatarFallback>
                          {(other.display_name ?? other.username ?? "?").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-xs">
                        {other.display_name ?? other.username}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      <div>
        {active?.otherProfile ? (
          <DirectMessageThread
            myProfileId={myProfileId}
            otherProfileId={active.otherProfile.id}
            otherDisplayName={
              active.otherProfile.display_name ?? active.otherProfile.username ?? "Friend"
            }
          />
        ) : (
          <Card className="flex h-[420px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Select a conversation to begin.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
