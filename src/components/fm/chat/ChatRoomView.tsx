import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { ReportSocialTargetDialog } from "@/features/social-safety/components/ReportSocialTargetDialog";
import { useChatRoom } from "./useChatRoom";

interface ChatRoomViewProps {
  channelKey: string | null;
  emptyMessage?: string;
  lockedMessage?: string | null;
  placeholder?: string;
}

export function ChatRoomView({
  channelKey,
  emptyMessage = "No messages yet — say hello.",
  lockedMessage = null,
  placeholder = "Type a message…",
}: ChatRoomViewProps) {
  const { profileId } = useActiveProfile();
  const { messages, loading, sending, sendMessage } = useChatRoom(lockedMessage ? null : channelKey);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLDivElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  if (lockedMessage) {
    return (
      <div className="flex-1 flex items-center justify-center px-3 text-center text-xs text-fm-fg-muted">
        {lockedMessage}
      </div>
    );
  }

  const handleSend = async () => {
    const text = draft;
    if (!text.trim() || sending) return;
    const ok = await sendMessage(text);
    if (ok) setDraft("");
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
        <div className="space-y-1.5 p-2">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-xs text-fm-fg-muted">
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : messages.length === 0 ? (
            <div className="py-6 text-center text-xs text-fm-fg-muted">{emptyMessage}</div>
          ) : (
            messages.map((msg) => {
              const mine = msg.profile_id === profileId;
              return (
                <div key={msg.id} className="text-[11px] leading-snug">
                  <span
                    className={cn(
                      "font-semibold",
                      mine ? "text-fm-accent" : "text-fm-fg-muted",
                    )}
                  >
                    {msg.displayName}
                  </span>
                  <span className="text-fm-fg-muted">
                    {" "}
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <div className="break-words text-fm-fg">{msg.message}</div>
                  {!mine && (
                    <ReportSocialTargetDialog
                      reportedProfileId={msg.profile_id}
                      targetType="chat_message"
                      targetId={msg.id}
                      triggerLabel="Report message"
                      context={{ surface: "fm_room_chat", channel: msg.channel }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      <div className="flex items-center gap-1.5 border-t border-fm-border p-1.5">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder={placeholder}
          maxLength={500}
          className="h-7 text-[11px]"
        />
        <Button
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => void handleSend()}
          disabled={sending || !draft.trim()}
          aria-label="Send message"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default ChatRoomView;
