import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, ChevronUp, ChevronDown, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatDock } from "./ChatDockContext";
import { useGameData } from "@/hooks/useGameData";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { DirectMessageThread } from "@/features/social-hub/components/DirectMessageThread";

const HIDDEN_PATHS = ["/auth", "/onboarding", "/create-character"];

export function FMChatDock() {
  const { pathname } = useLocation();
  const { profile } = useGameData();
  const myProfileId = (profile as any)?.id ?? null;
  const { open, setOpen, threads, openThread, closeThread } = useChatDock();
  const { friendships, loading } = useFriendships(myProfileId);

  const accepted = useMemo(
    () => friendships.filter((f) => f.friendship.status === "accepted" && f.otherProfile),
    [friendships],
  );

  if (!myProfileId) return null;
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  return (
    <div className="fixed bottom-0 right-3 z-40 flex items-end gap-2 pointer-events-none">
      {threads.map((t) => (
        <div
          key={t.profileId}
          className="pointer-events-auto w-[320px] h-[420px] bg-fm-panel border border-fm-border border-b-0 rounded-t-sm shadow-lg flex flex-col"
        >
          <div className="h-8 flex items-center justify-between px-2 bg-fm-panel-2 border-b border-fm-border">
            <span className="text-[11px] tracking-tight text-fm-fg font-medium truncate">
              {t.displayName}
            </span>
            <button
              onClick={() => closeThread(t.profileId)}
              className="text-fm-fg-muted hover:text-fm-fg"
              aria-label="Close chat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <DirectMessageThread
              myProfileId={myProfileId}
              otherProfileId={t.profileId}
              otherDisplayName={t.displayName}
            />
          </div>
        </div>
      ))}

      <div className="pointer-events-auto w-[260px] bg-fm-panel border border-fm-border border-b-0 rounded-t-sm shadow-lg flex flex-col">
        <button
          onClick={() => setOpen(!open)}
          className="h-8 flex items-center justify-between px-2 bg-fm-panel-2 border-b border-fm-border hover:bg-fm-panel-2/80"
        >
          <span className="flex items-center gap-1.5 text-[11px] tracking-tight text-fm-fg font-medium">
            <MessageSquare className="h-3.5 w-3.5 text-fm-accent" />
            Chat
            <span className="text-fm-fg-muted">({accepted.length})</span>
          </span>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        {open && (
          <div className="h-[320px] flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-fm-fg-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Loading…
              </div>
            ) : accepted.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-fm-fg-muted px-3 text-center">
                Add friends from Social to start chatting.
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="py-1">
                  {accepted.map((f) => {
                    const other = f.otherProfile!;
                    const name = other.display_name ?? other.username ?? "Friend";
                    const isOpen = threads.some((t) => t.profileId === other.id);
                    return (
                      <button
                        key={f.friendship.id}
                        onClick={() => openThread({ profileId: other.id, displayName: name })}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-fm-panel-2",
                          isOpen && "bg-fm-panel-2",
                        )}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={(other as any).avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-xs text-fm-fg">{name}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FMChatDock;
