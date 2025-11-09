import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { recordRelationshipEvent } from "../api";
import type { RelationshipEvent } from "../types";
import { MessageCircleHeart, ThumbsUp } from "lucide-react";

interface TimelineProps {
  profileId: string;
  otherProfileId: string;
  userId: string;
  events: RelationshipEvent[];
  onRefresh: () => void;
}

const REACTION_OPTIONS = [
  { id: "clap", label: "Clap" },
  { id: "fire", label: "Fire" },
  { id: "heart", label: "Heart" },
];

export function RelationshipTimeline({ profileId, otherProfileId, userId, events, onRefresh }: TimelineProps) {
  const { toast } = useToast();

  const handleReact = async (eventId: string, reaction: string) => {
    try {
      await recordRelationshipEvent({
        userId,
        profileId,
        otherProfileId,
        activityType: "relationship_reaction",
        message: `Reacted with ${reaction}`,
        metadata: { reaction, reacted_to: eventId },
      });
      toast({ title: "Reaction sent", description: "Your friend will see it in their activity feed." });
      onRefresh();
    } catch (error: unknown) {
      toast({
        title: "Unable to react",
        description: error instanceof Error ? error.message : "Something went wrong while sending your reaction.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Relationship Timeline</CardTitle>
          <CardDescription>Highlights, trades, collaborations, and shared memories.</CardDescription>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <MessageCircleHeart className="h-4 w-4" />
          {events.length} events
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No shared activity yet. Send a gift, launch a jam, or drop a DM to start building history.
          </p>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{event.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.metadata?.reaction && typeof event.metadata.reaction === 'string' && (
                      <Badge variant="secondary">Reacted with {event.metadata.reaction}</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleReact(event.id, "like")}
                    >
                      <ThumbsUp className="mr-1 h-4 w-4" /> React
                    </Button>
                  </div>
                </div>
                {event.metadata?.gift_amount && typeof event.metadata.gift_amount === 'number' && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Gifted {event.metadata.gift_amount} credits for {typeof event.metadata.gift_reason === 'string' ? event.metadata.gift_reason : "support"}.
                  </p>
                )}
                {event.metadata?.collaboration_type && typeof event.metadata.collaboration_type === 'string' && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Collaboration type: {event.metadata.collaboration_type}
                  </p>
                )}
                {event.metadata?.permissions && typeof event.metadata.permissions === 'object' && event.metadata.permissions !== null && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Permissions updated: {Object.keys(event.metadata.permissions).join(", ")}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {REACTION_OPTIONS.map((option) => (
                    <Button
                      key={option.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleReact(event.id, option.id)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

