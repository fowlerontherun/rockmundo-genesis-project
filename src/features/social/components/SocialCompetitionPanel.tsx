import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Trophy, Users, Swords, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";

const db = supabase as any;

type Rivalry = {
  id: string;
  challenger_profile_id: string;
  rival_profile_id: string;
  challenger_name: string;
  rival_name: string;
  metric: string;
  target: number;
  status: string;
  challenger_score: number;
  rival_score: number;
  winner_profile_id?: string | null;
  requested_at: string;
  started_at?: string | null;
  ended_at?: string | null;
};

type Season = {
  id: string;
  name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  season_number: number;
  joined_global: boolean;
  joined_city: boolean;
};

type LeaderboardRow = {
  profile_id: string;
  display_name?: string | null;
  username: string;
  score: number;
  rank: number;
  is_self: boolean;
};

type Community = {
  id: string;
  name: string;
  description: string;
  community_type: string;
  city_id?: string | null;
  is_open: boolean;
  max_members: number;
  member_count: number;
  is_member: boolean;
  is_owner: boolean;
};

const metricLabels: Record<string, string> = {
  fame_growth: "Fame growth",
  fan_growth: "Fan growth",
  experience_growth: "Experience growth",
};

const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const SocialCompetitionPanel = () => {
  const { profile } = useGameData();
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [rivalUsername, setRivalUsername] = useState("");
  const [rivalCandidate, setRivalCandidate] = useState<any>(null);
  const [rivalMetric, setRivalMetric] = useState("fame_growth");
  const [rivalTarget, setRivalTarget] = useState("100");

  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [seasonContext, setSeasonContext] = useState("global");
  const [seasonMetric, setSeasonMetric] = useState("fame_growth");

  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [communityType, setCommunityType] = useState("fan_club");

  const activeSeason = useMemo(() => seasons.find((season) => season.id === selectedSeasonId) ?? seasons.find((season) => season.is_active), [seasons, selectedSeasonId]);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setBusy(true);
    setMessage(null);
    try {
      const [rivalryResult, seasonResult, communityResult] = await Promise.all([
        db.rpc("get_my_social_rivalries", { p_profile_id: profile.id }),
        db.rpc("get_social_seasons", { p_profile_id: profile.id }),
        db.rpc("get_social_communities", { p_profile_id: profile.id }),
      ]);
      if (rivalryResult.error) throw rivalryResult.error;
      if (seasonResult.error) throw seasonResult.error;
      if (communityResult.error) throw communityResult.error;
      setRivalries(rivalryResult.data ?? []);
      setSeasons(seasonResult.data ?? []);
      setCommunities(communityResult.data ?? []);
      const nextSeasonId = selectedSeasonId || seasonResult.data?.find((season: Season) => season.is_active)?.id || seasonResult.data?.[0]?.id || "";
      setSelectedSeasonId(nextSeasonId);
    } catch (error: any) {
      setMessage(error?.message ?? "Could not load social competition data.");
    } finally {
      setBusy(false);
    }
  }, [profile?.id, selectedSeasonId]);

  const loadLeaderboard = useCallback(async () => {
    if (!profile?.id || !selectedSeasonId) {
      setLeaderboard([]);
      return;
    }
    const result = await db.rpc("get_social_season_leaderboard", {
      p_profile_id: profile.id,
      p_season_id: selectedSeasonId,
      p_context: seasonContext,
      p_metric: seasonMetric,
      p_limit: 50,
    });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setLeaderboard(result.data ?? []);
  }, [profile?.id, selectedSeasonId, seasonContext, seasonMetric]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadLeaderboard(); }, [loadLeaderboard]);

  const run = async (action: () => Promise<any>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (result?.error) throw result.error;
      setMessage(success);
      await load();
      await loadLeaderboard();
    } catch (error: any) {
      setMessage(error?.message ?? "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return null;

  const lookupRival = async () => {
    if (!rivalUsername.trim()) return;
    setBusy(true);
    setMessage(null);
    const result = await db.rpc("find_social_rival_candidate", { p_profile_id: profile.id, p_username: rivalUsername.trim() });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    const candidate = result.data?.[0] ?? null;
    setRivalCandidate(candidate);
    if (!candidate) setMessage("No eligible player found. Blocks and safety boundaries are intentionally not disclosed.");
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Social Competition</CardTitle>
            <CardDescription>Opt-in rivalries, contextual seasonal competition and player communities.</CardDescription>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}><RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-3 rounded-md border bg-muted/30 p-3 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>Everything here is optional. Rivalries can be declined or left without penalty, blocks immediately suppress interactions, and scores come only from verified game progress — players cannot submit their own scores.</p>
        </div>
        {message && <div className="rounded-md border px-3 py-2 text-sm">{message}</div>}

        <Tabs defaultValue="rivalries" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rivalries">Rivalries</TabsTrigger>
            <TabsTrigger value="seasons">Seasons</TabsTrigger>
            <TabsTrigger value="communities">Communities</TabsTrigger>
          </TabsList>

          <TabsContent value="rivalries" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Challenge a player</CardTitle><CardDescription>Find an eligible player by exact username. The other player must explicitly accept.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2 md:col-span-2"><Label>Username</Label><div className="flex gap-2"><Input value={rivalUsername} onChange={(e) => { setRivalUsername(e.target.value); setRivalCandidate(null); }} placeholder="username" /><Button variant="outline" disabled={busy || !rivalUsername.trim()} onClick={() => void lookupRival()}>Find</Button></div></div>
                <div className="space-y-2"><Label>Goal</Label><Select value={rivalMetric} onValueChange={setRivalMetric}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(metricLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Target growth</Label><Input type="number" min={10} max={1000000} value={rivalTarget} onChange={(e) => setRivalTarget(e.target.value)} /></div>
                {rivalCandidate && <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><div className="font-medium">{rivalCandidate.display_name || rivalCandidate.username} <span className="text-muted-foreground">@{rivalCandidate.username}</span></div><div className="text-xs text-muted-foreground">Current values are shown for context; only growth after acceptance counts.</div></div><Button disabled={busy} onClick={() => void run(() => db.rpc("request_social_rivalry", { p_profile_id: profile.id, p_rival_profile_id: rivalCandidate.profile_id, p_metric: rivalMetric, p_target: Number(rivalTarget) }), "Rivalry request sent.")}>Send challenge</Button></div>}
              </CardContent>
            </Card>

            {rivalries.map((rivalry) => {
              const amChallenger = rivalry.challenger_profile_id === profile.id;
              const amInvitedRival = rivalry.rival_profile_id === profile.id;
              return <Card key={rivalry.id}><CardContent className="space-y-3 pt-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-medium"><Swords className="mr-2 inline h-4 w-4" />{rivalry.challenger_name} vs {rivalry.rival_name}</div><Badge variant={rivalry.status === "active" ? "default" : "outline"}>{pretty(rivalry.status)}</Badge></div><div className="grid gap-2 text-sm sm:grid-cols-3"><div><span className="text-muted-foreground">Goal:</span> {metricLabels[rivalry.metric] ?? pretty(rivalry.metric)}</div><div><span className="text-muted-foreground">Score:</span> {rivalry.challenger_score} – {rivalry.rival_score}</div><div><span className="text-muted-foreground">Target:</span> {rivalry.target}</div></div><div className="flex flex-wrap gap-2">{amInvitedRival && rivalry.status === "pending" && <><Button size="sm" disabled={busy} onClick={() => void run(() => db.rpc("respond_social_rivalry", { p_profile_id: profile.id, p_rivalry_id: rivalry.id, p_accept: true }), "Rivalry accepted. Both baselines are now locked.")}>Accept</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => db.rpc("respond_social_rivalry", { p_profile_id: profile.id, p_rivalry_id: rivalry.id, p_accept: false }), "Rivalry declined.")}>Decline</Button></>}{rivalry.status === "active" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => db.rpc("refresh_social_rivalry", { p_profile_id: profile.id, p_rivalry_id: rivalry.id }), "Scores refreshed from verified progress.")}>Refresh verified scores</Button>}{["pending", "active"].includes(rivalry.status) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => db.rpc("leave_social_rivalry", { p_profile_id: profile.id, p_rivalry_id: rivalry.id }), "Rivalry ended without penalty.")}>Leave</Button>}</div>{amChallenger && rivalry.status === "pending" && <p className="text-xs text-muted-foreground">Waiting for the invited player. No progress is counted until they opt in.</p>}</CardContent></Card>;
            })}
            {!rivalries.length && <p className="text-sm text-muted-foreground">No rivalry history yet.</p>}
          </TabsContent>

          <TabsContent value="seasons" className="space-y-4">
            {!seasons.length && <Card><CardHeader><CardTitle className="text-base">No social season is open</CardTitle><CardDescription>Seasonal competitions only appear when a canonical leaderboard season is active or recently completed.</CardDescription></CardHeader></Card>}
            {!!seasons.length && <><div className="grid gap-3 md:grid-cols-3"><div className="space-y-2"><Label>Season</Label><Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{seasons.map((season) => <SelectItem key={season.id} value={season.id}>{season.name}{season.is_active ? " · Active" : ""}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Context</Label><Select value={seasonContext} onValueChange={setSeasonContext}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="global">Global</SelectItem><SelectItem value="city">Current city</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Metric</Label><Select value={seasonMetric} onValueChange={setSeasonMetric}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(metricLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>{activeSeason?.is_active && <div className="flex gap-2"><Button disabled={busy} onClick={() => void run(() => db.rpc("join_social_season", { p_profile_id: profile.id, p_season_id: activeSeason.id, p_context: seasonContext, p_metric: seasonMetric }), "You joined the season. Your growth baseline is locked and cannot be reset by rejoining.")}>Join {seasonContext === "city" ? "city" : "global"} competition</Button></div>}<div className="space-y-2">{leaderboard.map((row) => <div key={row.profile_id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${row.is_self ? "bg-primary/5" : ""}`}><div className="flex items-center gap-3"><span className="w-8 font-semibold">#{row.rank}</span><span>{row.display_name || row.username}{row.is_self ? " (you)" : ""}</span></div><span className="font-medium">+{row.score}</span></div>)}{selectedSeasonId && !leaderboard.length && <p className="text-sm text-muted-foreground">No opted-in competitors for this context and metric yet.</p>}</div></>}
          </TabsContent>

          <TabsContent value="communities" className="space-y-4">
            <Card><CardHeader><CardTitle className="text-base">Create a community</CardTitle><CardDescription>Fan clubs, local scenes and learning groups are opt-in and bounded in size.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label>Name</Label><Input maxLength={60} value={communityName} onChange={(e) => setCommunityName(e.target.value)} /></div><div className="space-y-2"><Label>Type</Label><Select value={communityType} onValueChange={setCommunityType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fan_club">Fan club</SelectItem><SelectItem value="scene">Scene</SelectItem><SelectItem value="learning">Learning</SelectItem><SelectItem value="general">General</SelectItem></SelectContent></Select></div><div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea maxLength={500} value={communityDescription} onChange={(e) => setCommunityDescription(e.target.value)} /></div><div className="md:col-span-2"><Button disabled={busy || communityName.trim().length < 3} onClick={() => void run(() => db.rpc("create_social_community", { p_profile_id: profile.id, p_name: communityName, p_description: communityDescription, p_type: communityType, p_is_open: true, p_max_members: 100 }), "Community created.")}>Create community</Button></div></CardContent></Card>
            <div className="grid gap-3 md:grid-cols-2">{communities.map((community) => <Card key={community.id}><CardHeader><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{community.name}</CardTitle><Badge variant="outline">{pretty(community.community_type)}</Badge></div><CardDescription>{community.description || "Player community"}</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Members</span><span>{community.member_count}/{community.max_members}</span></div>{community.is_owner ? <Badge>Owner</Badge> : community.is_member ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => db.rpc("leave_social_community", { p_profile_id: profile.id, p_community_id: community.id }), "Community left.")}>Leave</Button> : <Button size="sm" disabled={busy || !community.is_open} onClick={() => void run(() => db.rpc("join_social_community", { p_profile_id: profile.id, p_community_id: community.id }), "Community joined.")}>Join</Button>}</CardContent></Card>)}</div>
            {!communities.length && <p className="text-sm text-muted-foreground"><Users className="mr-2 inline h-4 w-4" />No visible communities yet.</p>}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
