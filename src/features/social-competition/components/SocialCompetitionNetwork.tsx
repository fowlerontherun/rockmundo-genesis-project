import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Globe2,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Swords,
  Trophy,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SafetyActions } from "@/components/social-safety/SafetyActions";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type PlayerMetric = "fame_growth" | "fan_growth" | "experience_growth";
type BandMetric = Exclude<PlayerMetric, "experience_growth">;
type CompetitionContext = "global" | "city";

interface PlayerCandidate {
  profile_id: string;
  display_name: string | null;
  username: string;
  fame: number;
  fans: number;
  experience: number;
}

interface PlayerRivalry {
  id: string;
  challenger_profile_id: string;
  rival_profile_id: string;
  challenger_name: string;
  rival_name: string;
  metric: PlayerMetric;
  target: number;
  status: string;
  challenger_score: number;
  rival_score: number;
  winner_profile_id: string | null;
  requested_at: string;
  started_at: string | null;
  ended_at: string | null;
}

interface BandOption {
  band_id: string;
  band_name: string;
  fame: number;
  fans: number;
  can_manage: boolean;
}

interface BandCandidate {
  band_id: string;
  band_name: string;
  genre: string | null;
  fame: number;
  fans: number;
}

interface BandRivalry {
  id: string;
  challenger_band_id: string;
  rival_band_id: string;
  challenger_name: string;
  rival_name: string;
  initiated_by_profile_id: string | null;
  accepted_by_profile_id: string | null;
  metric: BandMetric;
  target: number;
  status: string;
  challenger_score: number;
  rival_score: number;
  winner_band_id: string | null;
  requested_at: string;
  started_at: string | null;
  ended_at: string | null;
  can_respond: boolean;
  can_manage: boolean;
}

interface RivalryEvent {
  id: string;
  event_type: string;
  actor_profile_id: string | null;
  challenger_score: number | null;
  rival_score: number | null;
  evidence: Record<string, unknown>;
  created_at: string;
}

interface Community {
  id: string;
  owner_profile_id: string;
  owner_name: string;
  name: string;
  description: string;
  community_type: string;
  city_id: string | null;
  is_open: boolean;
  max_members: number;
  member_count: number;
  is_member: boolean;
  is_owner: boolean;
}

interface CommunityMember {
  profile_id: string;
  display_name: string | null;
  username: string;
  role: string;
  joined_at: string;
  is_self: boolean;
}

interface SocialSeason {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  season_number: number;
  joined_global: boolean;
  joined_city: boolean;
}

interface CompetitionEntry {
  id: string;
  season_id: string;
  season_name: string;
  profile_id: string;
  context: CompetitionContext;
  context_city_id: string | null;
  metric: PlayerMetric;
  baseline_value: number;
  score: number;
  final_rank: number | null;
  joined_at: string;
  withdrawn_at: string | null;
  finalised_at: string | null;
  eligible_for_award: boolean;
}

interface Standing {
  profile_id: string;
  display_name: string | null;
  username: string;
  score: number;
  rank: number;
  is_self: boolean;
}

interface Recognition {
  code: string;
  name: string;
  description: string;
  rarity: string;
  tier: string;
  awarded_at: string;
  rank: number | null;
  metadata: Record<string, unknown>;
}

interface SocialCompetitionNetworkProps {
  showIntro?: boolean;
}

const playerMetrics: { value: PlayerMetric; label: string }[] = [
  { value: "fame_growth", label: "Fame gained" },
  { value: "fan_growth", label: "Fans gained" },
  { value: "experience_growth", label: "Experience gained" },
];

const bandMetrics: { value: BandMetric; label: string }[] = playerMetrics.slice(0, 2) as { value: BandMetric; label: string }[];

const metricLabel = (metric: string) => playerMetrics.find((option) => option.value === metric)?.label ?? metric.replaceAll("_", " ");
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "—";
const errorLabel = (value: string) => value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const memberName = (member: CommunityMember) => member.display_name?.trim() || member.username;

function StatusBadge({ status }: { status: string }) {
  const variant = status === "active" ? "default" : status === "pending" ? "secondary" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

function ScoreTrack({ left, right, target }: { left: number; right: number; target: number }) {
  const max = Math.max(target, left, right, 1);
  return (
    <div className="space-y-1" aria-label={`Score ${left} to ${right}; target ${target}`}>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>{left.toLocaleString()}</span><span className="text-right">{right.toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="flex h-2 justify-end overflow-hidden rounded-l bg-muted"><span className="h-full bg-primary" style={{ width: `${Math.min(100, (left / max) * 100)}%` }} /></div>
        <div className="h-2 overflow-hidden rounded-r bg-muted"><span className="block h-full bg-primary" style={{ width: `${Math.min(100, (right / max) * 100)}%` }} /></div>
      </div>
    </div>
  );
}

export function SocialCompetitionNetwork({ showIntro = true }: SocialCompetitionNetworkProps) {
  const { profileId, isLoading: profileLoading } = useActiveProfile();
  const { toast } = useToast();
  const [playerRivalries, setPlayerRivalries] = useState<PlayerRivalry[]>([]);
  const [bandOptions, setBandOptions] = useState<BandOption[]>([]);
  const [bandRivalries, setBandRivalries] = useState<BandRivalry[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [seasons, setSeasons] = useState<SocialSeason[]>([]);
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [recognition, setRecognition] = useState<Recognition[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [playerQuery, setPlayerQuery] = useState("");
  const [playerCandidate, setPlayerCandidate] = useState<PlayerCandidate | null>(null);
  const [playerMetric, setPlayerMetric] = useState<PlayerMetric>("fame_growth");
  const [playerTarget, setPlayerTarget] = useState("100");
  const [bandId, setBandId] = useState("");
  const [bandQuery, setBandQuery] = useState("");
  const [bandCandidate, setBandCandidate] = useState<BandCandidate | null>(null);
  const [bandMetric, setBandMetric] = useState<BandMetric>("fame_growth");
  const [bandTarget, setBandTarget] = useState("100");
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [history, setHistory] = useState<RivalryEvent[]>([]);

  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [communityType, setCommunityType] = useState("fan_club");
  const [communityOpen, setCommunityOpen] = useState(true);
  const [communityCapacity, setCommunityCapacity] = useState("100");
  const [membersCommunityId, setMembersCommunityId] = useState<string | null>(null);
  const [communityMembers, setCommunityMembers] = useState<Record<string, CommunityMember[]>>({});

  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [seasonContext, setSeasonContext] = useState<CompetitionContext>("global");
  const [seasonMetric, setSeasonMetric] = useState<PlayerMetric>("fame_growth");

  const activeSeason = useMemo(() => seasons.find((season) => season.is_active), [seasons]);
  const selectedSeason = useMemo(
    () => seasons.find((season) => season.id === selectedSeasonId) ?? activeSeason ?? seasons[0],
    [activeSeason, seasons, selectedSeasonId],
  );

  const loadData = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setPageError(null);
    const results = await Promise.all([
      supabase.rpc("get_my_social_rivalries", { p_profile_id: profileId }),
      supabase.rpc("get_social_competition_band_options", { p_profile_id: profileId }),
      supabase.rpc("get_my_social_band_rivalries", { p_profile_id: profileId }),
      supabase.rpc("get_social_community_directory", { p_profile_id: profileId }),
      supabase.rpc("get_social_seasons", { p_profile_id: profileId }),
      supabase.rpc("get_my_social_competition_entries", { p_profile_id: profileId }),
      supabase.rpc("get_my_d11_recognition", { p_profile_id: profileId }),
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setPageError(failed.error.message);
      setLoading(false);
      return;
    }
    setPlayerRivalries((results[0].data ?? []) as unknown as PlayerRivalry[]);
    const nextBandOptions = (results[1].data ?? []) as unknown as BandOption[];
    setBandOptions(nextBandOptions);
    setBandId((current) => current || nextBandOptions.find((band) => band.can_manage)?.band_id || nextBandOptions[0]?.band_id || "");
    setBandRivalries((results[2].data ?? []) as unknown as BandRivalry[]);
    setCommunities((results[3].data ?? []) as unknown as Community[]);
    const nextSeasons = (results[4].data ?? []) as unknown as SocialSeason[];
    setSeasons(nextSeasons);
    setSelectedSeasonId((current) => current || nextSeasons.find((season) => season.is_active)?.id || nextSeasons[0]?.id || "");
    setEntries((results[5].data ?? []) as unknown as CompetitionEntry[]);
    setRecognition((results[6].data ?? []) as unknown as Recognition[]);
    setLoading(false);
  }, [profileId]);

  const loadLeaderboard = useCallback(async () => {
    if (!profileId || !selectedSeason?.id) {
      setStandings([]);
      return;
    }
    setLeaderboardLoading(true);
    const result = await supabase.rpc("get_social_season_leaderboard", {
      p_profile_id: profileId,
      p_season_id: selectedSeason.id,
      p_context: seasonContext,
      p_metric: seasonMetric,
      p_limit: 50,
    });
    if (result.error) {
      toast({ title: "Standings unavailable", description: result.error.message, variant: "destructive" });
      setStandings([]);
    } else {
      setStandings((result.data ?? []) as unknown as Standing[]);
    }
    setLeaderboardLoading(false);
  }, [profileId, seasonContext, seasonMetric, selectedSeason?.id, toast]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { void loadLeaderboard(); }, [loadLeaderboard, refreshToken]);

  const runAction = async (
    key: string,
    successTitle: string,
    action: () => Promise<{ error: { message: string } | null }>,
  ) => {
    setBusy(key);
    const result = await action();
    if (result.error) {
      toast({ title: "Action could not be completed", description: errorLabel(result.error.message), variant: "destructive" });
      setBusy(null);
      return false;
    }
    toast({ title: successTitle });
    await loadData();
    setRefreshToken((value) => value + 1);
    setBusy(null);
    return true;
  };

  const findPlayer = async (event: FormEvent) => {
    event.preventDefault();
    if (!profileId || !playerQuery.trim()) return;
    setBusy("find-player");
    setPlayerCandidate(null);
    const result = await supabase.rpc("find_social_rival_candidate", { p_profile_id: profileId, p_username: playerQuery.trim() });
    if (result.error) toast({ title: "Player search failed", description: errorLabel(result.error.message), variant: "destructive" });
    else {
      const candidate = ((result.data ?? []) as unknown as PlayerCandidate[])[0] ?? null;
      setPlayerCandidate(candidate);
      if (!candidate) toast({ title: "No eligible player found", description: "Use an exact username. Blocked players are intentionally hidden." });
    }
    setBusy(null);
  };

  const challengePlayer = async () => {
    if (!profileId || !playerCandidate) return;
    const target = Number(playerTarget);
    if (!Number.isInteger(target) || target < 10 || target > 1_000_000) {
      toast({ title: "Choose a target from 10 to 1,000,000", variant: "destructive" });
      return;
    }
    const completed = await runAction("challenge-player", "Rivalry invitation sent", async () => await supabase.rpc("request_social_rivalry", {
      p_profile_id: profileId,
      p_rival_profile_id: playerCandidate.profile_id,
      p_metric: playerMetric,
      p_target: target,
    }));
    if (completed) {
      setPlayerCandidate(null);
      setPlayerQuery("");
    }
  };

  const findBand = async (event: FormEvent) => {
    event.preventDefault();
    if (!profileId || !bandId || !bandQuery.trim()) return;
    setBusy("find-band");
    setBandCandidate(null);
    const result = await supabase.rpc("find_social_band_rival_candidate", {
      p_profile_id: profileId,
      p_band_id: bandId,
      p_band_name: bandQuery.trim(),
    });
    if (result.error) toast({ title: "Band search failed", description: errorLabel(result.error.message), variant: "destructive" });
    else {
      const candidate = ((result.data ?? []) as unknown as BandCandidate[])[0] ?? null;
      setBandCandidate(candidate);
      if (!candidate) toast({ title: "No eligible band found", description: "Use an exact active band name. A target manager must be available." });
    }
    setBusy(null);
  };

  const challengeBand = async () => {
    if (!profileId || !bandId || !bandCandidate) return;
    const target = Number(bandTarget);
    if (!Number.isInteger(target) || target < 10 || target > 1_000_000) {
      toast({ title: "Choose a target from 10 to 1,000,000", variant: "destructive" });
      return;
    }
    const completed = await runAction("challenge-band", "Band rivalry invitation sent", async () => await supabase.rpc("request_social_band_rivalry", {
      p_profile_id: profileId,
      p_band_id: bandId,
      p_rival_band_id: bandCandidate.band_id,
      p_metric: bandMetric,
      p_target: target,
    }));
    if (completed) {
      setBandCandidate(null);
      setBandQuery("");
    }
  };

  const toggleHistory = async (scope: "player" | "band", rivalryId: string) => {
    const key = `${scope}:${rivalryId}`;
    if (historyKey === key) {
      setHistoryKey(null);
      setHistory([]);
      return;
    }
    if (!profileId) return;
    setBusy(`history-${key}`);
    const result = scope === "player"
      ? await supabase.rpc("get_social_rivalry_history", { p_profile_id: profileId, p_rivalry_id: rivalryId })
      : await supabase.rpc("get_social_band_rivalry_history", { p_profile_id: profileId, p_rivalry_id: rivalryId });
    if (result.error) toast({ title: "Rivalry history unavailable", description: result.error.message, variant: "destructive" });
    else {
      setHistory((result.data ?? []) as unknown as RivalryEvent[]);
      setHistoryKey(key);
    }
    setBusy(null);
  };

  const createCommunity = async (event: FormEvent) => {
    event.preventDefault();
    if (!profileId) return;
    const capacity = Number(communityCapacity);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 500) {
      toast({ title: "Choose a capacity from 2 to 500", variant: "destructive" });
      return;
    }
    const completed = await runAction("create-community", "Community created", async () => await supabase.rpc("create_social_community", {
      p_profile_id: profileId,
      p_name: communityName.trim(),
      p_description: communityDescription.trim(),
      p_type: communityType,
      p_is_open: communityOpen,
      p_max_members: capacity,
    }));
    if (completed) {
      setCommunityName("");
      setCommunityDescription("");
    }
  };

  const loadCommunityMembers = async (communityId: string) => {
    if (!profileId) return;
    if (membersCommunityId === communityId) {
      setMembersCommunityId(null);
      return;
    }
    setBusy(`members-${communityId}`);
    const result = await supabase.rpc("get_social_community_members", { p_profile_id: profileId, p_community_id: communityId });
    if (result.error) toast({ title: "Community members unavailable", description: result.error.message, variant: "destructive" });
    else {
      setCommunityMembers((current) => ({ ...current, [communityId]: (result.data ?? []) as unknown as CommunityMember[] }));
      setMembersCommunityId(communityId);
    }
    setBusy(null);
  };

  const removeCommunityMember = async (communityId: string, member: CommunityMember) => {
    if (!profileId || !window.confirm(`Remove ${memberName(member)} from this community? They cannot rejoin for seven days.`)) return;
    const completed = await runAction(`remove-${member.profile_id}`, "Member removed", async () => await supabase.rpc("remove_social_community_member", {
      p_profile_id: profileId,
      p_community_id: communityId,
      p_member_profile_id: member.profile_id,
    }));
    if (completed) {
      setMembersCommunityId(null);
      setCommunityMembers((current) => ({ ...current, [communityId]: [] }));
    }
  };

  const joinSeason = async () => {
    if (!profileId || !activeSeason) return;
    await runAction(`join-season-${seasonContext}-${seasonMetric}`, "Season entry confirmed", async () => await supabase.rpc("join_social_season", {
      p_profile_id: profileId,
      p_season_id: activeSeason.id,
      p_context: seasonContext,
      p_metric: seasonMetric,
    }));
  };

  if (profileLoading || loading) {
    return <div className="flex min-h-56 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading social competition…</div>;
  }

  if (!profileId) {
    return <Alert><Lock className="h-4 w-4" /><AlertTitle>Choose a character</AlertTitle><AlertDescription>An active character is required for rivalries, communities and seasonal competition.</AlertDescription></Alert>;
  }

  return (
    <div className="space-y-4">
      {showIntro && (
        <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Social competition</CardTitle><CardDescription className="mt-1 max-w-3xl">Opt into friendly player or band rivalries, build communities, and compete in fixed-baseline seasons.</CardDescription></div>
              <Badge variant="outline"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Prestige only</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <p><strong className="text-foreground">Consent first.</strong> Challenges require acceptance and either side can leave without a gameplay penalty.</p>
            <p><strong className="text-foreground">Harassment-safe.</strong> Blocks hide discovery and close interactions; report controls stay available.</p>
            <p><strong className="text-foreground">No pay-to-win.</strong> Results award history and bounded badges—never money, XP, AP or stat power.</p>
          </CardContent>
        </Card>
      )}

      {pageError && <Alert variant="destructive"><AlertTitle>Social competition is unavailable</AlertTitle><AlertDescription>{pageError} <Button variant="link" className="h-auto p-0" onClick={() => void loadData()}>Try again</Button></AlertDescription></Alert>}

      <Tabs defaultValue="rivalries" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rivalries"><Swords className="mr-2 h-4 w-4" />Rivalries</TabsTrigger>
          <TabsTrigger value="communities"><Users className="mr-2 h-4 w-4" />Communities</TabsTrigger>
          <TabsTrigger value="seasons"><Trophy className="mr-2 h-4 w-4" />Seasons</TabsTrigger>
        </TabsList>

        <TabsContent value="rivalries" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Challenge a player</CardTitle><CardDescription>Search by exact username. Requests expire after seven days; active rivalries last up to 30 days.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={findPlayer} className="flex gap-2"><Input aria-label="Exact player username" value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} placeholder="Exact username" maxLength={40} /><Button type="submit" variant="outline" disabled={!playerQuery.trim() || busy === "find-player"}>{busy === "find-player" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="sr-only">Find player</span></Button></form>
                {playerCandidate && <div className="space-y-3 rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{playerCandidate.display_name || playerCandidate.username}</p><p className="text-xs text-muted-foreground">@{playerCandidate.username} · {playerCandidate.fame.toLocaleString()} fame · {playerCandidate.fans.toLocaleString()} fans</p></div><SafetyActions targetProfileId={playerCandidate.profile_id} targetName={playerCandidate.display_name || playerCandidate.username} compact /></div><div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]"><Select value={playerMetric} onValueChange={(value) => setPlayerMetric(value as PlayerMetric)}><SelectTrigger aria-label="Player rivalry metric"><SelectValue /></SelectTrigger><SelectContent>{playerMetrics.map((metric) => <SelectItem key={metric.value} value={metric.value}>{metric.label}</SelectItem>)}</SelectContent></Select><Input aria-label="Player rivalry target" type="number" min={10} max={1_000_000} value={playerTarget} onChange={(event) => setPlayerTarget(event.target.value)} /><Button onClick={() => void challengePlayer()} disabled={busy === "challenge-player"}>Invite</Button></div></div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Challenge a band</CardTitle><CardDescription>Only band leaders and managers can invite or respond. Every active member can follow progress.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {bandOptions.length === 0 ? <p className="text-sm text-muted-foreground">Join an active band to view band rivalries.</p> : <><Select value={bandId} onValueChange={(value) => { setBandId(value); setBandCandidate(null); }}><SelectTrigger aria-label="Your band"><SelectValue placeholder="Choose your band" /></SelectTrigger><SelectContent>{bandOptions.map((band) => <SelectItem key={band.band_id} value={band.band_id}>{band.band_name}{band.can_manage ? " · manager" : " · member"}</SelectItem>)}</SelectContent></Select><form onSubmit={findBand} className="flex gap-2"><Input aria-label="Exact rival band name" value={bandQuery} onChange={(event) => setBandQuery(event.target.value)} placeholder="Exact rival band name" maxLength={80} /><Button type="submit" variant="outline" disabled={!bandQuery.trim() || busy === "find-band" || !bandOptions.find((band) => band.band_id === bandId)?.can_manage}>{busy === "find-band" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="sr-only">Find band</span></Button></form></>}
                {bandCandidate && <div className="space-y-3 rounded-lg border p-3"><div><p className="font-medium">{bandCandidate.band_name}</p><p className="text-xs text-muted-foreground">{bandCandidate.genre || "Unlisted genre"} · {bandCandidate.fame.toLocaleString()} fame · {bandCandidate.fans.toLocaleString()} fans</p></div><div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]"><Select value={bandMetric} onValueChange={(value) => setBandMetric(value as BandMetric)}><SelectTrigger aria-label="Band rivalry metric"><SelectValue /></SelectTrigger><SelectContent>{bandMetrics.map((metric) => <SelectItem key={metric.value} value={metric.value}>{metric.label}</SelectItem>)}</SelectContent></Select><Input aria-label="Band rivalry target" type="number" min={10} max={1_000_000} value={bandTarget} onChange={(event) => setBandTarget(event.target.value)} /><Button onClick={() => void challengeBand()} disabled={busy === "challenge-band"}>Invite</Button></div></div>}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Player rivalries</CardTitle><CardDescription>Server-measured growth from the baselines captured when both players consent.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {playerRivalries.length === 0 ? <p className="text-sm text-muted-foreground">No player rivalry history yet.</p> : playerRivalries.map((rivalry) => {
                  const isChallenger = rivalry.challenger_profile_id === profileId;
                  const opponentId = isChallenger ? rivalry.rival_profile_id : rivalry.challenger_profile_id;
                  const opponentName = isChallenger ? rivalry.rival_name : rivalry.challenger_name;
                  const incoming = rivalry.status === "pending" && rivalry.rival_profile_id === profileId;
                  const key = `player:${rivalry.id}`;
                  return <div key={rivalry.id} className="space-y-3 rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{rivalry.challenger_name} <span className="text-muted-foreground">vs</span> {rivalry.rival_name}</p><p className="text-xs text-muted-foreground">{metricLabel(rivalry.metric)} · target {rivalry.target.toLocaleString()} · requested {dateLabel(rivalry.requested_at)}</p></div><StatusBadge status={rivalry.status} /></div><ScoreTrack left={rivalry.challenger_score} right={rivalry.rival_score} target={rivalry.target} /><div className="flex flex-wrap gap-2">{incoming && <><Button size="sm" onClick={() => void runAction(`accept-${rivalry.id}`, "Rivalry accepted", async () => await supabase.rpc("respond_social_rivalry", { p_profile_id: profileId, p_rivalry_id: rivalry.id, p_accept: true }))} disabled={busy === `accept-${rivalry.id}`}><Check className="mr-1 h-4 w-4" />Accept</Button><Button size="sm" variant="outline" onClick={() => void runAction(`decline-${rivalry.id}`, "Rivalry declined", async () => await supabase.rpc("respond_social_rivalry", { p_profile_id: profileId, p_rivalry_id: rivalry.id, p_accept: false }))} disabled={busy === `decline-${rivalry.id}`}><X className="mr-1 h-4 w-4" />Decline</Button></>}{rivalry.status === "active" && <Button size="sm" variant="outline" onClick={() => void runAction(`refresh-${rivalry.id}`, "Scores checked", async () => await supabase.rpc("refresh_social_rivalry", { p_profile_id: profileId, p_rivalry_id: rivalry.id }))} disabled={busy === `refresh-${rivalry.id}`}><RefreshCw className="mr-1 h-4 w-4" />Check progress</Button>}{["pending", "active"].includes(rivalry.status) && <Button size="sm" variant="outline" onClick={() => void runAction(`leave-${rivalry.id}`, "Rivalry ended without penalty", async () => await supabase.rpc("leave_social_rivalry", { p_profile_id: profileId, p_rivalry_id: rivalry.id }))} disabled={busy === `leave-${rivalry.id}`}><LogOut className="mr-1 h-4 w-4" />Leave</Button>}<Button size="sm" variant="ghost" onClick={() => void toggleHistory("player", rivalry.id)}>{historyKey === key ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}History</Button></div><div className="flex flex-wrap gap-2"><SafetyActions targetProfileId={opponentId} targetName={opponentName} compact /></div>{historyKey === key && <RivalryHistory events={history} />}</div>;
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Band rivalries</CardTitle><CardDescription>Manager consent with server-measured band fame or fan growth.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {bandRivalries.length === 0 ? <p className="text-sm text-muted-foreground">No band rivalry history yet.</p> : bandRivalries.map((rivalry) => {
                  const key = `band:${rivalry.id}`;
                  return <div key={rivalry.id} className="space-y-3 rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{rivalry.challenger_name} <span className="text-muted-foreground">vs</span> {rivalry.rival_name}</p><p className="text-xs text-muted-foreground">{metricLabel(rivalry.metric)} · target {rivalry.target.toLocaleString()} · requested {dateLabel(rivalry.requested_at)}</p></div><StatusBadge status={rivalry.status} /></div><ScoreTrack left={rivalry.challenger_score} right={rivalry.rival_score} target={rivalry.target} /><div className="flex flex-wrap gap-2">{rivalry.can_respond && <><Button size="sm" onClick={() => void runAction(`band-accept-${rivalry.id}`, "Band rivalry accepted", async () => await supabase.rpc("respond_social_band_rivalry", { p_profile_id: profileId, p_rivalry_id: rivalry.id, p_accept: true }))} disabled={busy === `band-accept-${rivalry.id}`}><Check className="mr-1 h-4 w-4" />Accept</Button><Button size="sm" variant="outline" onClick={() => void runAction(`band-decline-${rivalry.id}`, "Band rivalry declined", async () => await supabase.rpc("respond_social_band_rivalry", { p_profile_id: profileId, p_rivalry_id: rivalry.id, p_accept: false }))} disabled={busy === `band-decline-${rivalry.id}`}><X className="mr-1 h-4 w-4" />Decline</Button></>}{rivalry.status === "active" && <Button size="sm" variant="outline" onClick={() => void runAction(`band-refresh-${rivalry.id}`, "Band scores checked", async () => await supabase.rpc("refresh_social_band_rivalry", { p_profile_id: profileId, p_rivalry_id: rivalry.id }))} disabled={busy === `band-refresh-${rivalry.id}`}><RefreshCw className="mr-1 h-4 w-4" />Check progress</Button>}{rivalry.can_manage && ["pending", "active"].includes(rivalry.status) && <Button size="sm" variant="outline" onClick={() => void runAction(`band-leave-${rivalry.id}`, "Band rivalry ended without penalty", async () => await supabase.rpc("leave_social_band_rivalry", { p_profile_id: profileId, p_rivalry_id: rivalry.id }))} disabled={busy === `band-leave-${rivalry.id}`}><LogOut className="mr-1 h-4 w-4" />End</Button>}<Button size="sm" variant="ghost" onClick={() => void toggleHistory("band", rivalry.id)}>{historyKey === key ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}History</Button></div>{historyKey === key && <RivalryHistory events={history} />}</div>;
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="communities" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]">
            <Card>
              <CardHeader><CardTitle>Create a community</CardTitle><CardDescription>Start a fan club, local scene, learning circle or general community.</CardDescription></CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={createCommunity}>
                  <div className="space-y-1"><Label htmlFor="community-name">Name</Label><Input id="community-name" minLength={3} maxLength={60} required value={communityName} onChange={(event) => setCommunityName(event.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="community-description">Description</Label><Textarea id="community-description" maxLength={500} value={communityDescription} onChange={(event) => setCommunityDescription(event.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Type</Label><Select value={communityType} onValueChange={setCommunityType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fan_club">Fan club</SelectItem><SelectItem value="scene">Local scene</SelectItem><SelectItem value="learning">Learning</SelectItem><SelectItem value="general">General</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label htmlFor="community-capacity">Capacity</Label><Input id="community-capacity" type="number" min={2} max={500} value={communityCapacity} onChange={(event) => setCommunityCapacity(event.target.value)} /></div></div>
                  <label className="flex items-start gap-2 text-sm"><Checkbox checked={communityOpen} onCheckedChange={(checked) => setCommunityOpen(Boolean(checked))} /><span><strong>Open to join</strong><span className="block text-xs text-muted-foreground">Private communities remain visible only to their members.</span></span></label>
                  <Button type="submit" className="w-full" disabled={!communityName.trim() || busy === "create-community"}>{busy === "create-community" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create community</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Community directory</CardTitle><CardDescription>Blocked owners and private non-member groups are excluded by the server.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {communities.length === 0 ? <p className="text-sm text-muted-foreground">No communities are available yet.</p> : communities.map((community) => <div key={community.id} className="space-y-3 rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{community.name}</p><p className="text-xs text-muted-foreground">{community.community_type.replaceAll("_", " ")} · owner {community.owner_name} · {community.member_count}/{community.max_members} members</p></div><div className="flex gap-1">{community.is_owner && <Badge>Owner</Badge>}<Badge variant="outline">{community.is_open ? "Open" : "Private"}</Badge></div></div>{community.description && <p className="text-sm text-muted-foreground">{community.description}</p>}<div className="flex flex-wrap gap-2">{!community.is_member && community.is_open && community.member_count < community.max_members && <Button size="sm" onClick={() => void runAction(`join-community-${community.id}`, "Community joined", async () => await supabase.rpc("join_social_community", { p_profile_id: profileId, p_community_id: community.id }))} disabled={busy === `join-community-${community.id}`}>Join</Button>}{community.is_member && !community.is_owner && <Button size="sm" variant="outline" onClick={() => void runAction(`leave-community-${community.id}`, "Community left", async () => await supabase.rpc("leave_social_community", { p_profile_id: profileId, p_community_id: community.id }))} disabled={busy === `leave-community-${community.id}`}><LogOut className="mr-1 h-4 w-4" />Leave</Button>}{community.is_owner && <Button size="sm" variant="outline" onClick={() => void runAction(`toggle-community-${community.id}`, community.is_open ? "Community made private" : "Community opened", async () => await supabase.rpc("update_social_community", { p_profile_id: profileId, p_community_id: community.id, p_description: community.description, p_is_open: !community.is_open, p_max_members: community.max_members }))} disabled={busy === `toggle-community-${community.id}`}>{community.is_open ? <Lock className="mr-1 h-4 w-4" /> : <Globe2 className="mr-1 h-4 w-4" />}{community.is_open ? "Make private" : "Open joins"}</Button>}{community.is_member && <Button size="sm" variant="ghost" onClick={() => void loadCommunityMembers(community.id)}>{membersCommunityId === community.id ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}Members</Button>}{!community.is_owner && <SafetyActions targetProfileId={community.owner_profile_id} targetName={community.owner_name} compact />}</div>{membersCommunityId === community.id && <div className="space-y-2 border-t pt-3">{(communityMembers[community.id] ?? []).map((member) => <div key={member.profile_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-sm"><div><span className="font-medium">{memberName(member)}</span> <Badge variant="outline" className="ml-1">{member.role}</Badge><p className="text-xs text-muted-foreground">Joined {dateLabel(member.joined_at)}</p></div>{community.is_owner && !member.is_self && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void removeCommunityMember(community.id, member)} disabled={busy === `remove-${member.profile_id}`}><UserMinus className="mr-1 h-4 w-4" />Remove</Button><SafetyActions targetProfileId={member.profile_id} targetName={memberName(member)} compact /></div>}</div>)}</div>}</div>)}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seasons" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />{activeSeason?.name ?? "No active season"}</CardTitle><CardDescription>{activeSeason ? `${dateLabel(activeSeason.start_date)}–${dateLabel(activeSeason.end_date)}. ${activeSeason.description}` : "The next season will be created by the daily rollover."}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Fixed-baseline, one-account entry</AlertTitle><AlertDescription>Your starting value is captured once and preserved if you withdraw and rejoin. Another character slot cannot enter the same context and metric. Only positive growth can earn a badge.</AlertDescription></Alert>
                {activeSeason && <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]"><Select value={seasonContext} onValueChange={(value) => setSeasonContext(value as CompetitionContext)}><SelectTrigger aria-label="Competition context"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="global">Global</SelectItem><SelectItem value="city">Current city</SelectItem></SelectContent></Select><Select value={seasonMetric} onValueChange={(value) => setSeasonMetric(value as PlayerMetric)}><SelectTrigger aria-label="Season metric"><SelectValue /></SelectTrigger><SelectContent>{playerMetrics.map((metric) => <SelectItem key={metric.value} value={metric.value}>{metric.label}</SelectItem>)}</SelectContent></Select><Button onClick={() => void joinSeason()} disabled={busy === `join-season-${seasonContext}-${seasonMetric}`}>Join season</Button></div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recognition</CardTitle><CardDescription>Permanent history and cosmetic-prestige badges.</CardDescription></CardHeader>
              <CardContent className="space-y-2">{recognition.length === 0 ? <p className="text-sm text-muted-foreground">No D11 recognition earned yet.</p> : recognition.slice(0, 8).map((award) => <div key={`${award.code}-${award.awarded_at}`} className="flex gap-2 rounded-md border p-2"><Award className="mt-0.5 h-4 w-4 text-primary" /><div><p className="text-sm font-medium">{award.name}</p><p className="text-xs text-muted-foreground">{award.rank ? `Rank ${award.rank} · ` : ""}{dateLabel(award.awarded_at)}</p></div></div>)}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Your entries</CardTitle><CardDescription>Withdrawn and finalised entries remain visible as season history.</CardDescription></CardHeader>
            <CardContent className="space-y-2">{entries.length === 0 ? <p className="text-sm text-muted-foreground">You have not entered a social season yet.</p> : entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{entry.season_name} · {entry.context}</p><p className="text-xs text-muted-foreground">{metricLabel(entry.metric)} · baseline {entry.baseline_value.toLocaleString()} · score {entry.score.toLocaleString()}{entry.final_rank ? ` · final rank ${entry.final_rank}` : ""}</p></div><div className="flex items-center gap-2">{entry.withdrawn_at ? <Badge variant="outline">Withdrawn</Badge> : entry.finalised_at ? <Badge>Final</Badge> : <Badge variant="secondary">Active</Badge>}{!entry.withdrawn_at && !entry.finalised_at && <Button size="sm" variant="outline" onClick={() => void runAction(`leave-season-${entry.id}`, "Season entry withdrawn", async () => await supabase.rpc("leave_social_season", { p_profile_id: profileId, p_entry_id: entry.id }))} disabled={busy === `leave-season-${entry.id}`}><LogOut className="mr-1 h-4 w-4" />Withdraw</Button>}</div></div>)}</CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Season standings</CardTitle><CardDescription>Live canonical growth, grouped by global or your captured city context.</CardDescription></div><div className="flex flex-wrap gap-2"><Select value={selectedSeason?.id ?? ""} onValueChange={setSelectedSeasonId}><SelectTrigger className="w-52" aria-label="Standings season"><SelectValue placeholder="Choose season" /></SelectTrigger><SelectContent>{seasons.map((season) => <SelectItem key={season.id} value={season.id}>{season.name}</SelectItem>)}</SelectContent></Select><Select value={seasonContext} onValueChange={(value) => setSeasonContext(value as CompetitionContext)}><SelectTrigger className="w-32" aria-label="Standings context"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="global"><Globe2 className="mr-1 inline h-3.5 w-3.5" />Global</SelectItem><SelectItem value="city"><MapPin className="mr-1 inline h-3.5 w-3.5" />City</SelectItem></SelectContent></Select><Select value={seasonMetric} onValueChange={(value) => setSeasonMetric(value as PlayerMetric)}><SelectTrigger className="w-48" aria-label="Standings metric"><SelectValue /></SelectTrigger><SelectContent>{playerMetrics.map((metric) => <SelectItem key={metric.value} value={metric.value}>{metric.label}</SelectItem>)}</SelectContent></Select></div></div></CardHeader>
            <CardContent>{leaderboardLoading ? <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading standings…</div> : standings.length === 0 ? <p className="text-sm text-muted-foreground">No active entries in this leaderboard yet.</p> : <ol className="space-y-2">{standings.map((standing) => <li key={standing.profile_id} className={`grid grid-cols-[3rem_1fr_auto] items-center gap-2 rounded-md border p-2 text-sm ${standing.is_self ? "border-primary bg-primary/5" : ""}`}><span className="font-semibold">#{standing.rank}</span><span>{standing.display_name || standing.username}{standing.is_self && <Badge className="ml-2" variant="outline">You</Badge>}</span><span className="tabular-nums">{standing.score.toLocaleString()}</span></li>)}</ol>}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RivalryHistory({ events }: { events: RivalryEvent[] }) {
  if (events.length === 0) return <p className="border-t pt-3 text-xs text-muted-foreground">No history events are available.</p>;
  return <ol className="space-y-1 border-t pt-3">{events.map((event) => <li key={event.id} className="flex items-center justify-between gap-2 text-xs"><span className="capitalize">{event.event_type.replaceAll("_", " ")}</span><span className="text-muted-foreground">{dateLabel(event.created_at)}{event.challenger_score !== null && event.rival_score !== null ? ` · ${event.challenger_score}–${event.rival_score}` : ""}</span></li>)}</ol>;
}

export default SocialCompetitionNetwork;
