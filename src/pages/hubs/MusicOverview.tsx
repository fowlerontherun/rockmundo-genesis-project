import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Disc3, Guitar, ListMusic, Mic2, Music, Plus, Radio, Sparkles, Users } from "lucide-react";

import HubLayout from "@/components/hub/HubLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { musicHubNavigation } from "@/config/hubNavigation";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";

const MusicOverview = () => {
  const { profileId } = useActiveProfile();
  const { profile } = useGameData();
  const userId = profile?.user_id ?? profileId;

  const songsQuery = useQuery({
    queryKey: ["user-songs", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("songs")
        .select("id,title,status,genre,quality_score,practice_level,archived,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const recordingsQuery = useQuery({
    queryKey: ["recording_sessions", userId, "music-overview"],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("recording_sessions")
        .select("id,status,scheduled_start,scheduled_end,song_id,songs(title)")
        .eq("user_id", userId)
        .order("scheduled_start", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const releasesQuery = useQuery({
    queryKey: ["releases", profileId, "music-overview"],
    enabled: !!profileId,
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("releases")
        .select("id,title,release_type,release_status,release_date,created_at")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const songs = songsQuery.data ?? [];
    return {
      writing: songs.filter((song) => song.status === "draft" && !song.archived).length,
      completed: songs.filter((song) => ["completed", "recorded", "released"].includes(song.status ?? "") && !song.archived).length,
      needsPractice: songs.filter((song) => Number(song.practice_level ?? 0) < 60 && !song.archived).length,
      recordingReady: songs.filter((song) => Number(song.quality_score ?? 0) >= 50 && !song.archived).length,
    };
  }, [songsQuery.data]);

  const actions = [
    { label: "Write a song", path: "/music/songwriting", icon: Plus },
    { label: "Practice", path: "/music/practice", icon: Guitar, variant: "secondary" as const },
    { label: "Book recording", path: "/music/recording", icon: Disc3, variant: "outline" as const },
    { label: "Create release", path: "/music/releases", icon: Radio, variant: "outline" as const },
  ];

  const isLoading = songsQuery.isLoading || recordingsQuery.isLoading || releasesQuery.isLoading;
  const error = songsQuery.error || recordingsQuery.error || releasesQuery.error;

  return (
    <HubLayout
      title="Music"
      description="Move your songs through writing, practice, rehearsal, recording, release and performance."
      icon={Music}
      overviewPath="/music"
      navigation={musicHubNavigation}
      actions={actions}
    >
      {isLoading ? <PageLoadingState title="Loading Music" description="Checking your songs, recordings and releases." /> : null}
      {error ? (
        <PageErrorState
          title="Music could not be loaded"
          description="Retry to reload your music overview without leaving the hub."
          onRetry={() => {
            void songsQuery.refetch();
            void recordingsQuery.refetch();
            void releasesQuery.refetch();
          }}
        />
      ) : null}
      {!isLoading && !error ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Songs being written" value={stats.writing} icon={Sparkles} to="/music/songwriting" />
            <SummaryCard title="Completed songs" value={stats.completed} icon={ListMusic} to="/music/songs" />
            <SummaryCard title="Need practice" value={stats.needsPractice} icon={Guitar} to="/music/practice" />
            <SummaryCard title="Recording ready" value={stats.recordingReady} icon={Disc3} to="/music/recording" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <WorkflowCard title="Current songs" description="Continue writing or choose songs to practise next." to="/music/songs">
              {(songsQuery.data ?? []).slice(0, 4).map((song) => (
                <li key={song.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="truncate font-medium">{song.title}</span>
                  <Badge variant="outline">{song.status ?? "draft"}</Badge>
                </li>
              ))}
            </WorkflowCard>
            <WorkflowCard title="Recording" description="Review recent or booked studio sessions." to="/music/recording">
              {(recordingsQuery.data ?? []).slice(0, 4).map((session: any) => (
                <li key={session.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="truncate font-medium">{session.songs?.title ?? "Studio session"}</span>
                  <Badge variant="secondary">{session.status}</Badge>
                </li>
              ))}
            </WorkflowCard>
            <WorkflowCard title="Releases" description="Check recent drafts, planned releases and live releases." to="/music/releases">
              {(releasesQuery.data ?? []).slice(0, 4).map((release) => (
                <li key={release.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="truncate font-medium">{release.title}</span>
                  <Badge>{release.release_status}</Badge>
                </li>
              ))}
            </WorkflowCard>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Creation-to-release workflow</CardTitle>
              <CardDescription>Use the existing systems in order, or jump to the step you need.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[
                ["Songwriting", "/music/songwriting", Sparkles],
                ["Practice", "/music/practice", Guitar],
                ["Rehearsals", "/music/rehearsals", Users],
                ["Jam Sessions", "/music/jam-sessions", Mic2],
                ["Recording", "/music/recording", Disc3],
                ["Releases", "/music/releases", Radio],
              ].map(([label, to, Icon]: any) => (
                <Button key={to} asChild variant="outline" className="gap-2">
                  <Link to={to}><Icon className="h-4 w-4" />{label}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </HubLayout>
  );
};

function SummaryCard({ title, value, icon: Icon, to }: { title: string; value: number; icon: typeof Music; to: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <Button asChild variant="link" className="h-auto p-0 text-xs"><Link to={to}>Open</Link></Button>
      </CardContent>
    </Card>
  );
}

function WorkflowCard({ title, description, to, children }: { title: string; description: string; to: string; children: ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : true;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">{hasItems ? children : <li className="text-sm text-muted-foreground">Nothing to show yet.</li>}</ul>
        <Button asChild variant="secondary" size="sm"><Link to={to}>View {title}</Link></Button>
      </CardContent>
    </Card>
  );
}

export default MusicOverview;
