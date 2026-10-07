import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Phone, SendHorizontal, X } from "lucide-react";
import { format } from "date-fns";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { ReportSocialTargetDialog } from "@/features/social-safety/components/ReportSocialTargetDialog";
import { DirectVoiceChat } from "./DirectVoiceChat";
import { cn } from "@/lib/utils";

interface Props {
  myProfileId: string;
  otherProfileId: string;
  otherDisplayName: string;
  compact?: boolean;
}

export function DirectMessageThread({
  myProfileId,
  otherProfileId,
  otherDisplayName,
  compact = false,
}: Props) {
  const { channelId, messages, isLoading, sendMessage, markRead } = useDirectMessages(
    myProfileId,
    otherProfileId,
  );
  const [draft, setDraft] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLDivElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (messages.length) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const handleSend = () => {
    if (!draft.trim() || sendMessage.isPending) return;
    sendMessage.mutate(draft, { onSuccess: () => setDraft("") });
  };

  return (
    <Card className={cn("flex h-full flex-col", compact && "min-h-0 rounded-none border-0 shadow-none")}>
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between space-y-0 pb-3",
          compact && "shrink-0 px-2 py-2",
        )}
      >
        <CardTitle className={compact ? "text-xs" : "text-base"}>
          Chat with {otherDisplayName}
        </CardTitle>
        <Button
          variant={voiceOpen ? "destructive" : "outline"}
          size={compact ? "icon" : "sm"}
          className={compact ? "h-7 w-7 shrink-0" : undefined}
          onClick={() => setVoiceOpen((v) => !v)}
          disabled={!channelId}
          aria-label={voiceOpen ? "Close voice chat" : "Start voice chat"}
        >
          {voiceOpen ? (
            <X className={cn("h-4 w-4", !compact && "mr-1")} />
          ) : (
            <Phone className={cn("h-4 w-4", !compact && "mr-1")} />
          )}
          {!compact && (voiceOpen ? "Close voice" : "Voice call")}
        </Button>
      </CardHeader>
      {voiceOpen && channelId && (
        <div className={compact ? "px-2 pb-2" : "px-4 pb-3"}>
          <DirectVoiceChat channelId={channelId} />
        </div>
      )}
      <CardContent
        className={cn(
          "flex-1 overflow-hidden",
          compact && "flex min-h-0 flex-col px-2 pb-2",
        )}
      >
        {sendMessage.isSuccess && (
          <p className="mb-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700" role="status">
            Message sent.
          </p>
        )}
        {sendMessage.isError && (
          <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {sendMessage.error instanceof Error ? sendMessage.error.message : "We couldn't send that message."}
          </p>
        )}
        <ScrollArea className={compact ? "min-h-0 flex-1" : "h-[360px]"} ref={scrollRef}>
          <div className="space-y-2 pr-3">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Start the conversation with {otherDisplayName}.
              </p>
            ) : (
              messages.map((m) => {
                const isSelf = m.sender_profile_id === myProfileId;
                return (
                  <div key={m.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                        isSelf ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="mt-1 text-right text-[10px] opacity-70">
                        {format(new Date(m.created_at), "MMM d, HH:mm")}
                      </p>
                      {!isSelf && (
                        <div className="mt-1 flex justify-end">
                          <ReportSocialTargetDialog
                            reportedProfileId={m.sender_profile_id}
                            targetType="direct_message"
                            targetId={m.id}
                            triggerLabel="Report message"
                            context={{ surface: "direct_message_thread" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className={cn("flex flex-col gap-2", compact && "shrink-0 px-2 pb-2")}>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${otherDisplayName}`}
          aria-label={`Message ${otherDisplayName}`}
          maxLength={2000}
          disabled={sendMessage.isPending}
          className={compact ? "min-h-[44px] max-h-[64px] resize-none" : "min-h-[72px]"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
          }}
        />
        <div className="flex w-full justify-between text-xs text-muted-foreground">
          <span className={compact ? "sr-only" : undefined}>
            ⌘/Ctrl + Enter to send · {draft.trim().length}/2,000
          </span>
          <Button onClick={handleSend} disabled={sendMessage.isPending || !draft.trim()} size="sm" aria-label={`Send message to ${otherDisplayName}`}>
            {sendMessage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <SendHorizontal className="mr-1 h-4 w-4" /> Send
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
