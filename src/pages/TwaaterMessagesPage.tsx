import { useState } from "react";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterMessages } from "@/hooks/useTwaaterMessages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { TwaaterConversation } from "@/components/twaater/TwaaterConversation";
import { useNavigate } from "react-router-dom";

export default function TwaaterMessagesPage() {
  const { profile } = useGameData();
  const { account, isLoading: accountLoading } = useTwaaterAccount("persona", profile?.id);
  const { conversations, isLoading } = useTwaaterMessages(account?.id);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const navigate = useNavigate();

  if (accountLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No Twaater account found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedConversation) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto">
          <div className="p-4 border-b bg-card flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedConversation(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="font-semibold">Messages</h2>
          </div>
          <TwaaterConversation
            conversationId={selectedConversation}
            accountId={account.id}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Direct Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!conversations || conversations.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No messages yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/twaater")}
                >
                  Find people to message
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation: any) => {
                  const otherParticipant = conversation.participant_1_id === account.id
                    ? conversation.participant_2
                    : conversation.participant_1;

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation.id)}
                      className="w-full p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{otherParticipant.display_name}</p>
                          <p className="text-sm text-muted-foreground">
                            @{otherParticipant.handle}
                          </p>
                        </div>
                        {conversation.last_message_at && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}