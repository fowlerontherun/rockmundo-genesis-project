import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, HelpCircle, Loader2, MessageSquare, UserPlus, Users } from "lucide-react";
import { ChatRoomView } from "@/components/fm/chat/ChatRoomView";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "./EmptyState";

type RoomId = "world" | "help" | "recruit" | "band" | "friends";

const rooms = [
  { id: "world" as RoomId, label: "World", icon: Globe },
  { id: "help" as RoomId, label: "Help", icon: HelpCircle },
  { id: "recruit" as RoomId, label: "Recruit", icon: UserPlus },
  { id: "band" as RoomId, label: "Band", icon: Users },
  { id: "friends" as RoomId, label: "Friends", icon: MessageSquare },
];

export function MobileInstantChat() {
  const navigate = useNavigate();
  const { profileId } = useActiveProfile();
  const { friendships, loading } = useFriendships(profileId);
  const { data: primaryBand } = usePrimaryBand();
  const [activeRoom, setActiveRoom] = useState<RoomId>("world");
  const bandId = (primaryBand as any)?.band_id ?? null;
  const bandName = (primaryBand as any)?.bands?.name ?? "Band";

  const accepted = useMemo(
    () => friendships.filter((f) => f.friendship.status === "accepted" && f.otherProfile),
    [friendships],
  );

  return (
    <div className="min-h-[62vh] overflow-hidden rounded-xl border border-fm-border bg-fm-panel shadow-sm">
      <div className="flex overflow-x-auto border-b border-fm-border bg-fm-panel-2/60 scrollbar-hide">
        {rooms.map((room) => {
          const Icon = room.icon;
          const active = activeRoom === room.id;
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => setActiveRoom(room.id)}
              className={cn(
                "rm-tap flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-xs font-medium text-fm-fg-muted",
                active && "border-b-2 border-fm-accent bg-fm-panel text-fm-accent",
              )}
            >
              <Icon className="h-4 w-4" />
              {room.label}
              {room.id === "friends" && accepted.length > 0 ? ` (${accepted.length})` : ""}
            </button>
          );
        })}
      </div>

      <div className="flex h-[56vh] min-h-[360px] flex-col">
        {activeRoom === "world" && (
          <ChatRoomView
            channelKey="world"
            emptyMessage="World Chat is quiet — start the conversation."
            placeholder="Message World Chat…"
          />
        )}
        {activeRoom === "help" && (
          <ChatRoomView
            channelKey="help"
            emptyMessage="Ask anything — players and staff answer here."
            placeholder="Ask for help…"
          />
        )}
        {activeRoom === "recruit" && (
          <ChatRoomView
            channelKey="recruit"
            emptyMessage="Post what you play and which band you're looking for."
            placeholder="Looking for a band / member…"
          />
        )}
        {activeRoom === "band" && (
          <ChatRoomView
            channelKey={bandId ? `band:${bandId}` : null}
            lockedMessage={bandId ? null : "Join or form a band to unlock band chat."}
            emptyMessage={`No messages in ${bandName} yet.`}
            placeholder={`Message ${bandName}…`}
          />
        )}
        {activeRoom === "friends" && (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-xs text-fm-fg-muted">
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : accepted.length === 0 ? (
              <EmptyState title="No friends yet" message="Add friends from Social to start chatting." />
            ) : (
              <div className="space-y-1">
                {accepted.map((f) => {
                  const other = f.otherProfile!;
                  const name = other.display_name ?? other.username ?? "Friend";
                  return (
                    <button
                      key={f.friendship.id}
                      type="button"
                      onClick={() => navigate(`/mobile/social/conversation/${other.id}`)}
                      className="rm-tap flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-fm-fg hover:bg-fm-panel-2"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={(other as any).avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                      <MessageSquare className="h-4 w-4 text-fm-fg-muted" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MobileInstantChat;
