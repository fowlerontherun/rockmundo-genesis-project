import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterMessages } from "@/hooks/useTwaaterMessages";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { TwaaterConversation } from "@/components/twaater/TwaaterConversation";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { useTwaaterRouteAccount } from "@/hooks/useTwaaterRouteAccount";

export default function TwaaterMessagesPage() {
  const { profile } = useGameData();
  const [searchParams] = useSearchParams();
  const { account: personaAccount, isLoading: personaLoading } = useTwaaterAccount("persona", profile?.id);
  const { account, isLoading: routeAccountLoading } = useTwaaterRouteAccount(personaAccount, searchParams.get("account"));
  const accountLoading = personaLoading || routeAccountLoading;
  const { conversations, isLoading } = useTwaaterMessages(account?.id);
  const accountSuffix = account?.id ? `&account=${encodeURIComponent(account.id)}` : "";
  const messagesRoot = account?.id ? `/twaater/messages?account=${encodeURIComponent(account.id)}` : "/twaater/messages";
  const backTo = account?.id ? `/twaater?account=${encodeURIComponent(account.id)}` : "/twaater";
  const selectedConversation = searchParams.get("conversation");
  const navigate = useNavigate();
  const selectedConversationIsOwned =
    !selectedConversation || Boolean(conversations?.some((conversation: any) => conversation.id === selectedConversation));

  if (accountLoading || isLoading) {
    return (
      <FMPageScaffold title="Direct Messages" icon={MessageCircle} backTo={backTo}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </FMPageScaffold>
    );
  }

  if (!account) {
    return (
      <FMPageScaffold title="Direct Messages" icon={MessageCircle} backTo={backTo}>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No Twaater account found</p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  if (account.owner_type !== "persona") {
    const personaMessagesUrl = personaAccount?.id
      ? `/twaater/messages?account=${encodeURIComponent(personaAccount.id)}`
      : "/twaater/messages";

    return (
      <FMPageScaffold title="Direct Messages" icon={MessageCircle} backTo={backTo}>
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <p className="font-medium">Direct messages are available from artist accounts.</p>
            <p className="text-sm text-muted-foreground">
              Band Twaater accounts can post, follow and receive notifications, but private conversations use your artist identity.
            </p>
            {personaAccount && (
              <Button onClick={() => navigate(personaMessagesUrl)}>
                Open artist messages
              </Button>
            )}
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  if (selectedConversation && !selectedConversationIsOwned) {
    return (
      <FMPageScaffold title="Messages" icon={MessageCircle} backTo={messagesRoot}>
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <p className="font-medium">Conversation unavailable</p>
            <p className="text-sm text-muted-foreground">
              This conversation does not belong to the selected Twaater account.
            </p>
            <Button onClick={() => navigate(messagesRoot, { replace: true })}>
              Back to conversations
            </Button>
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
        backTo={messagesRoot}
        headerActions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(messagesRoot, { replace: true })}
            className="gap-1"
          >
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
    <FMPageScaffold title="Direct Messages" icon={MessageCircle} backTo={backTo} backLabel="Back to Twaater">
      <Card>
        <CardContent className="p-4">
          {!conversations || conversations.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No messages yet</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate(backTo)}
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
                    onClick={() =>
                      navigate(`/twaater/messages?conversation=${conversation.id}${accountSuffix}`, { replace: true })
                    }
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
