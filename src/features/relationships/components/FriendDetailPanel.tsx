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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">{profile.display_name ?? profile.username}</CardTitle>
          <CardDescription>
            Level {profile.level ?? "—"} • Fame {profile.fame ?? "—"} • Fans {profile.fans ?? "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
          <div className="space-y-4">
            <AffinityMeter summary={summary} />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Relationship Status</CardTitle>
                <CardDescription>Set the tone of your partnership.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {RELATIONSHIP_STATUSES.map((status) => (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => setActiveStatus((prev) => (prev === status.id ? null : status.id))}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition hover:border-primary ${
                      activeStatus === status.id ? "border-primary bg-primary/5" : "border-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden>
                        {status.emoji}
                      </span>
                      <p className="font-semibold">{status.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{status.reputation}</p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {status.unlocks.map((unlock) => (
                        <li key={unlock}>• {unlock}</li>
                      ))}
                    </ul>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Permissions</CardTitle>
                <CardDescription>Choose how much access this friend has.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {TRUST_PERMISSION_LEVELS.map((level) => (
                  <div key={level.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <Shield className="mt-1 h-4 w-4" />
                    <div>
                      <p className="text-sm font-semibold">{level.label}</p>
                      <p className="text-xs text-muted-foreground">{level.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick actions</CardTitle>
                <CardDescription>Every action boosts affinity and unlocks perks.</CardDescription>
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
          </div>
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

