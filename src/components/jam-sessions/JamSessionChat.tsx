import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useJamSessionChat, ChatMessage } from "@/hooks/useJamSessionChat";
import { MessageCircle, Send, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface JamSessionChatProps {
  sessionId: string;
  sessionName: string;
}

export const JamSessionChat = ({ sessionId, sessionName }: JamSessionChatProps) => {
  const { messages, presence, isLoading, isSending, sendMessage, myProfileId } = useJamSessionChat(sessionId);
  const [inputMessage, setInputMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputMessage.trim()) return;
    await sendMessage(inputMessage);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getMessageStyle = (messageType: string) => {
    switch (messageType) {
      case "system":
        return "bg-muted/50 text-muted-foreground text-center italic";
      case "join":
        return "bg-green-500/10 text-green-600 text-center";
      case "leave":
        return "bg-red-500/10 text-red-600 text-center";
      default:
        return "";
    }
  };

  const isSystemMessage = (type: string) => ["system", "join", "leave"].includes(type);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Session Chat
          </CardTitle>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Badge variant="secondary" className="text-xs">
              {presence.length} online
            </Badge>
          </div>
        </div>

        {/* Online presence indicators */}
        {presence.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2">
            {presence.map((p) => (
              <div
                key={p.profile_id}
                className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 rounded-full"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-600">{p.display_name}</span>
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isOwn = msg.profile_id === myProfileId;
                const isSystem = isSystemMessage(msg.message_type);
                const displayName = msg.profile?.display_name || msg.profile?.username || "Unknown";

                if (isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className={cn("text-xs py-1.5 px-3 rounded", getMessageStyle(msg.message_type))}
                    >
                      {msg.message}
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={cn("flex gap-2", isOwn && "flex-row-reverse")}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={msg.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn("flex flex-col max-w-[75%]", isOwn && "items-end")}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium">{displayName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm",
                          isOwn
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {msg.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Message input */}
        <div className="p-3 border-t flex gap-2">
          <Input
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSending}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputMessage.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
