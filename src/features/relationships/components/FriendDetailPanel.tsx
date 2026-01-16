import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DecoratedFriendship, RelationshipSummary, RelationshipEvent } from "../types";
import { RELATIONSHIP_STATUSES, TRUST_PERMISSION_LEVELS } from "../config";
import { AffinityMeter } from "./AffinityMeter";
import { QuickActionButtons } from "./ActionButtons";
import { RelationshipTimeline } from "./Timeline";
import { DirectMessagePanel } from "./DirectMessagePanel";
import { resolveRelationshipPairKey } from "../api";
import { Shield } from "lucide-react";

interface FriendDetailPanelProps {
  friendship: DecoratedFriendship | null;
  summary: RelationshipSummary;
  events: RelationshipEvent[];
  currentProfileId: string;
  currentUserId: string | null;
  onRefreshEvents: () => void;
}

export function FriendDetailPanel({
  friendship,
  summary,
  events,
  currentProfileId,
  currentUserId,
  onRefreshEvents,
}: FriendDetailPanelProps) {
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const profile = friendship?.otherProfile ?? null;

  const channelId = useMemo(() => {
    if (!friendship?.otherProfile?.user_id) {
      return null;
    }
    return `dm:${resolveRelationshipPairKey(currentProfileId, friendship.otherProfile.id)}`;
  }, [friendship?.otherProfile?.id, friendship?.otherProfile?.user_id, currentProfileId]);

  if (!friendship || !profile) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Select a friend</CardTitle>
          <CardDescription>Choose someone from the list to view relationship details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">{profile.display_name ?? profile.username}</CardTitle>
          <CardDescription>
            Level {profile.level ?? 1} • Fame {profile.fame?.toLocaleString() ?? 0} • {profile.fans?.toLocaleString() ?? 0} fans
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AffinityMeter summary={summary} />
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent>
              <QuickActionButtons
                profileId={currentProfileId}
                userId={currentUserId}
                otherProfileId={profile.id}
                otherUserId={profile.user_id}
                otherDisplayName={profile.display_name ?? profile.username ?? "Friend"}
                onEventRecorded={onRefreshEvents}
              />
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="dm" disabled={!channelId || !currentUserId}>
            Direct messages
          </TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)]">
          <RelationshipTimeline
            profileId={currentProfileId}
            otherProfileId={profile.id}
            userId={currentUserId}
            events={events}
            onRefresh={onRefreshEvents}
          />
          <Card>
            <CardHeader>
              <CardTitle>Profile Snapshot</CardTitle>
              <CardDescription>Latest stats you both can see.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-semibold">Cash on hand</p>
                  <p className="text-xs text-muted-foreground">Personal funds available for collaborations</p>
                </div>
                <Badge variant="secondary">{profile.cash ?? 0} credits</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-semibold">Current city</p>
                  <p className="text-xs text-muted-foreground">Where they&apos;re active right now</p>
                </div>
                <Badge variant="outline">{profile.current_city_id ?? "Unknown"}</Badge>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm font-semibold">Bio</p>
                <p className="text-sm text-muted-foreground">{profile.bio ?? "No bio shared yet."}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="dm">
          {channelId && currentUserId && (
            <DirectMessagePanel
              channel={channelId}
              currentUserId={currentUserId}
              otherDisplayName={profile.display_name ?? profile.username ?? "Friend"}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

