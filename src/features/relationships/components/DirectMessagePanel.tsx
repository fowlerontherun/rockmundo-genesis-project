import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { fetchDirectMessages, sendDirectMessage, subscribeToDirectMessages } from "../api";
import type { DirectMessage } from "../types";
import { Loader2, SendHorizontal } from "lucide-react";
import { format } from "date-fns";

interface DirectMessagePanelProps {
  channel: string;
  currentUserId: string;
  otherDisplayName: string;
}

export function DirectMessagePanel({ channel, currentUserId, otherDisplayName }: DirectMessagePanelProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const load = async () => {
      setLoading(true);
      try {
        const history = await fetchDirectMessages(channel);
        setMessages(history);
        unsubscribe = subscribeToDirectMessages(channel, (message) => {
          setMessages((prev) => [...prev, message]);
        });
      } catch (error: unknown) {
        console.error("Failed to load DMs", error);
        toast({
          title: "Unable to load messages",
          description:
            error instanceof Error
              ? error.message
              : "Something went wrong while fetching the DM history.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [channel, toast]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim()) {
      return;
    }

    setSending(true);
    try {
      await sendDirectMessage(channel, currentUserId, draft);
      setDraft("");
    } catch (error: unknown) {
      toast({
        title: "Unable to send message",
        description: error instanceof Error ? error.message : "Something went wrong while sending your DM.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
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
                const isSelf = message.user_id === currentUserId;
                return (
                  <div key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-lg border p-3 text-sm shadow-sm ${
                        isSelf ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.message}</p>
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
          <Button onClick={handleSend} disabled={sending || !draft.trim()}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <SendHorizontal className="mr-1 h-4 w-4" /> Send
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

