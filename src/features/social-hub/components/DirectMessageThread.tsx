import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Phone, SendHorizontal, X } from "lucide-react";
import { format } from "date-fns";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { DirectVoiceChat } from "./DirectVoiceChat";

interface Props {
  myProfileId: string;
  otherProfileId: string;
  otherDisplayName: string;
}

export function DirectMessageThread({ myProfileId, otherProfileId, otherDisplayName }: Props) {
  const { channelId, messages, isLoading, sendMessage, markRead } = useDirectMessages(
    myProfileId,
    otherProfileId,
  );
  const [draft, setDraft] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (messages.length) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const handleSend = () => {
    if (!draft.trim()) return;
    sendMessage.mutate(draft, { onSuccess: () => setDraft("") });
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Chat with {otherDisplayName}</CardTitle>
        <Button
          variant={voiceOpen ? "destructive" : "outline"}
          size="sm"
          onClick={() => setVoiceOpen((v) => !v)}
          disabled={!channelId}
        >
          {voiceOpen ? <X className="h-4 w-4 mr-1" /> : <Phone className="h-4 w-4 mr-1" />}
          {voiceOpen ? "Close voice" : "Voice call"}
        </Button>
      </CardHeader>
      {voiceOpen && channelId && (
        <div className="px-4 pb-3">
          <DirectVoiceChat channelId={channelId} />
        </div>
      )}
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-[360px]" ref={scrollRef}>
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${otherDisplayName}`}
          className="min-h-[72px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
          }}
        />
        <div className="flex w-full justify-between text-xs text-muted-foreground">
          <span>⌘/Ctrl + Enter to send</span>
          <Button onClick={handleSend} disabled={sendMessage.isPending || !draft.trim()} size="sm">
            {sendMessage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <SendHorizontal className="mr-1 h-4 w-4" /> Send
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
