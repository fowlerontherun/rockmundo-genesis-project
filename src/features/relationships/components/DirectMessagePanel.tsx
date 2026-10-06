import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { Loader2, SendHorizontal } from "lucide-react";
import { format } from "date-fns";
import { useActiveProfile } from "@/hooks/useActiveProfile";

interface DirectMessagePanelProps {
  channel: string;
  currentUserId: string;
  otherDisplayName: string;
}

export function DirectMessagePanel({ channel, currentUserId, otherDisplayName }: DirectMessagePanelProps) {
  const { toast } = useToast();
  const { profileId } = useActiveProfile();
  const otherProfileId = useMemo(() => {
    if (!profileId || !channel.startsWith("dm:")) return null;
    const participants = channel.slice(3).split(":").filter(Boolean);
    return participants.find((id) => id !== profileId) ?? null;
  }, [channel, profileId]);
  const { messages, isLoading: loading, sendMessage, markRead } = useDirectMessages(profileId, otherProfileId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (messages.length) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const handleSend = () => {
    if (!draft.trim() || sendMessage.isPending || !otherProfileId) return;
    sendMessage.mutate(draft, {
      onSuccess: () => setDraft(""),
      onError: (error: unknown) => toast({
        title: "Unable to send message",
        description: error instanceof Error ? error.message : "Something went wrong while sending your DM.",
        variant: "destructive",
      }),
    });
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Direct Messages</CardTitle>
        <CardDescription>Private chat with {otherDisplayName}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-[320px]" ref={scrollRef}>
          <div className="space-y-3 pr-4">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No messages yet. Say hello and start planning your next collaboration!
              </p>
            ) : (
              messages.map((message) => {
                const isSelf = message.sender_profile_id === profileId;
                return (
                  <div key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-lg border p-3 text-sm shadow-sm ${
                        isSelf ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className="mt-1 text-right text-xs opacity-70">
                        {message.created_at ? format(new Date(message.created_at), "MMM d, HH:mm") : "Just now"}
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
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Message ${otherDisplayName}`}
          className="min-h-[80px]"
        />
        <div className="flex w-full justify-end">
          <Button onClick={handleSend} disabled={sendMessage.isPending || !draft.trim() || !otherProfileId}>
            {sendMessage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <SendHorizontal className="mr-1 h-4 w-4" /> Send
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

