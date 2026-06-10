import { useState } from "react";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterMessages } from "@/hooks/useTwaaterMessages";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { TwaaterConversation } from "@/components/twaater/TwaaterConversation";
import { useNavigate } from "react-router-dom";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function TwaaterMessagesPage() {
  const { profile } = useGameData();
  const { account, isLoading: accountLoading } = useTwaaterAccount("persona", profile?.id);
  const { conversations, isLoading } = useTwaaterMessages(account?.id);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const navigate = useNavigate();

  if (accountLoading || isLoading) {
    return (
      <FMPageScaffold title="Direct Messages" icon={MessageCircle} backTo="/twaater">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </FMPageScaffold>
    );
  }

  if (!account) {
    return (
      <FMPageScaffold title="Direct Messages" icon={MessageCircle} backTo="/twaater">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No Twaater account found</p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  if (selectedConversation) {
    return (
      <FMPageScaffold
        title="Messages"
        icon={MessageCircle}
        backTo="/twaater/messages"
        headerActions={
          <Button variant="outline" size="sm" onClick={() => setSelectedConversation(null)} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Conversations
          </Button>
        }
      >
        <TwaaterConversation
          conversationId={selectedConversation}
          accountId={account.id}
        />
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold title="Direct Messages" icon={MessageCircle} backTo="/twaater" backLabel="Back to Twaater">
      <Card>
        <CardContent className="p-4">
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
    </FMPageScaffold>
  );
}
