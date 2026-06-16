import { Suspense, lazy, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Loader2, Users, MessageSquare, Heart, Compass, Inbox } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { MessagesTab } from "@/features/social-hub/components/MessagesTab";
import { InvitesInbox } from "@/features/social-hub/components/InvitesInbox";
import { useInviteRealtime } from "@/hooks/useSocialInvites";

// Heavier pieces — lazy to keep initial bundle slim
const Relationships = lazy(() => import("./Relationships"));
const PlayerSearch = lazy(() => import("./PlayerSearch"));
const FamilyDashboard = lazy(() =>
  import("@/components/family/FamilyDashboard").then((m) => ({ default: m.FamilyDashboard })),
);

const TABS = ["friends", "messages", "family", "discover", "invites"] as const;
type TabValue = (typeof TABS)[number];

const TAB_LABELS: Record<TabValue, { label: string; icon: typeof Users }> = {
  friends: { label: "Friends", icon: Users },
  messages: { label: "Messages", icon: MessageSquare },
  family: { label: "Family", icon: Heart },
  discover: { label: "Discover", icon: Compass },
  invites: { label: "Invites", icon: Inbox },
};

const Fallback = () => (
  <div className="flex h-40 items-center justify-center text-muted-foreground">
    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
  </div>
);

export default function SocialHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as TabValue) || "friends";
  const { profileId } = useActiveProfile();
  useInviteRealtime(profileId);

  useEffect(() => {
    if (!TABS.includes(tab)) {
      setSearchParams({ tab: "friends" }, { replace: true });
    }
  }, [tab, setSearchParams]);

  return (
    <PageLayout>
      <PageHeader
        title="Social"
        subtitle="Friends, family, chat & invites — all in one place."
        icon={Users}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
        className="space-y-4"
      >
        <TabsList className="flex w-full overflow-x-auto">
          {TABS.map((t) => {
            const { label, icon: Icon } = TAB_LABELS[t];
            return (
              <TabsTrigger key={t} value={t} className="flex items-center gap-1.5 text-xs">
                <Icon className="h-3.5 w-3.5" /> {label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          <Suspense fallback={<Fallback />}>
            <Relationships />
          </Suspense>
        </TabsContent>

        <TabsContent value="messages">
          <MessagesTab myProfileId={profileId} />
        </TabsContent>

        <TabsContent value="family">
          <Suspense fallback={<Fallback />}>
            {profileId ? (
              <FamilyDashboard />
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Sign in to view your family.
                </CardContent>
              </Card>
            )}
          </Suspense>
          <div className="mt-3 text-xs text-muted-foreground">
            Need more? Visit the{" "}
            <Link to="/family/timeline" className="underline">
              family timeline
            </Link>
            .
          </div>
        </TabsContent>

        <TabsContent value="discover">
          <Suspense fallback={<Fallback />}>
            <PlayerSearch />
          </Suspense>
        </TabsContent>

        <TabsContent value="invites">
          <InvitesInbox profileId={profileId} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
