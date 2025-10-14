import { Card, CardContent } from "@/components/ui/card";
import { TwaatCard } from "./TwaatCard";
import { Loader2 } from "lucide-react";
import { useTwaaterMentions } from "@/hooks/useTwaaterMentions";

interface TwaaterMentionsFeedProps {
  accountId: string;
}

export const TwaaterMentionsFeed = ({ accountId }: TwaaterMentionsFeedProps) => {
  const { mentions, isLoading } = useTwaaterMentions(accountId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!mentions || mentions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">No mentions yet</p>
            <p className="text-sm text-muted-foreground">
              When others mention @{accountId} in their twaats, they'll appear here!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {mentions.map((mention: any) => (
        <TwaatCard
          key={mention.id}
          twaat={mention.twaat}
          viewerAccountId={accountId}
        />
      ))}
    </div>
  );
};
