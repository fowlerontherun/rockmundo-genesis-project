import { useState, useEffect, useMemo, type ReactNode, type ElementType, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Activity,
  Users,
  TrendingUp,
  Guitar,
  DollarSign,
  Star,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Bell,
  Calendar,
  ChevronDown,
  ChevronUp,
  Mic,
  MapPin,
  Cake,
  Music,
  CalendarDays,
  UserPlus,
  Loader2,
  UserX,
  Check,
  X,
  Search,
  Clock,
} from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import RealtimeChatPanel from "@/components/chat/RealtimeChatPanel";
import { CurrentLocationWidget } from "@/components/city/CurrentLocationWidget";
import type { Database } from "@/lib/supabase-types";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayerPresenceStats } from "@/hooks/usePlayerPresenceStats";
import { GameDateWidget } from "@/components/calendar/GameDateWidget";
import { DaySchedule } from "@/components/schedule/DaySchedule";
import { useRecentSkillImprovements } from "@/hooks/useRecentSkillImprovements";
import { TrendingUp as TrendingUpIcon } from "lucide-react";
import { deriveCityChannel } from "@/utils/chat";
import { AchievementsSection } from "@/components/character/AchievementsSection";
import { CurrentLearningSection } from "@/components/character/CurrentLearningSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  deleteFriendship,
  fetchFriendshipsForProfile,
  fetchProfilesByIds,
  searchProfilesByQuery,
  sendFriendRequest,
  updateFriendshipStatus,
} from "@/integrations/supabase/friends";

type ChatScope = "general" | "city";

interface ActivityEntry {
  id: string;
  activity_type: string;
  message: string;
  created_at: string;
  earnings: number;
  metadata?: Record<string, unknown> | null;
}

interface DashboardNotification {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  iconClasses: string;
  timestamp?: string;
}

const formatNotificationDate = (isoString: string | null | undefined) => {
  if (!isoString) return undefined;
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const formatSkillName = (slug: string) =>
  slug
    .split(/[_-]/)
    .filter(segment => segment.length > 0)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const sanitizeAttributeLabel = (label: string) =>
  label
    .replace(/_/g, " ")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const formatDate = (input: string | null | undefined) => {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
};

const PROFILE_META_FIELDS: Array<{ key: any; label: string; icon: ElementType }> = [
  { key: "current_location", label: "Hometown", icon: MapPin },
  { key: "age", label: "Age", icon: Cake },
  { key: "genre", label: "Primary Genre", icon: Music },
  { key: "fame", label: "Fame", icon: Sparkles },
  { key: "fans", label: "Fans", icon: Users },
];

const MIN_ATTRIBUTE_SCORE = 5;
const DAILY_XP_STIPEND = 100;
const DEFAULT_ATTRIBUTE_SPEND = 10;
const DEFAULT_SKILL_SPEND = 25;
const MINIMUM_SEARCH_LENGTH = 2;

const ATTRIBUTE_COLUMN_KEY_MAP: Record<string, string> = {
  creativity: "creative_insight",
  technical: "technical_mastery",
  charisma: "charisma",
  looks: "looks",
  mental_focus: "mental_focus",
  musicality: "musicality",
  musical_ability: "musical_ability",
  physical_endurance: "physical_endurance",
  stage_presence: "stage_presence",
  crowd_engagement: "crowd_engagement",
  social_reach: "social_reach",
  creative_insight: "creative_insight",
  technical_mastery: "technical_mastery",
  vocal_talent: "vocal_talent",
  rhythm_sense: "rhythm_sense",
};

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

interface DecoratedFriendship {
  friendship: FriendshipRow;
  otherProfile: ProfileRow | null;
  isRequester: boolean;
}

const Dashboard = () => {
  const [currentTab, setCurrentTab] = useState<ChatScope>("general");
  const [mainTab, setMainTab] = useState<string>("overview");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const {
    profile,
    skills,
    attributes,
    xpWallet,
    skillProgress,
    dailyXpGrant,
    claimDailyXp,
    spendAttributeXp,
    spendSkillXp,
    loading: gameDataLoading,
    currentCity,
  } = useGameData();
  const { onlinePlayers, totalPlayers } = usePlayerPresenceStats();
  const { toast } = useToast();

  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [claimingDailyXp, setClaimingDailyXp] = useState(false);
  const [attributeXpInputs, setAttributeXpInputs] = useState<Record<string, number>>({});
  const [attributeSpendPending, setAttributeSpendPending] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [skillXpAmount, setSkillXpAmount] = useState<number>(DEFAULT_SKILL_SPEND);
  const [skillSpendPending, setSkillSpendPending] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [actionTarget, setActionTarget] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!profile?.user_id) return;
      setActivityLoading(true);
      const { data } = await supabase
        .from("activity_feed")
        .select("*")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(10);
      setActivityFeed((data || []) as ActivityEntry[]);
      setActivityLoading(false);
    };
    fetchActivity();
  }, [profile?.user_id]);

  // Load friendships
  useEffect(() => {
    const loadFriendships = async () => {
      if (!profile?.id) {
        setFriendships([]);
        setProfilesById({});
        return;
      }
      setLoadingFriends(true);
      try {
        const data = await fetchFriendshipsForProfile(profile.id);
        setFriendships(data);
        const relatedProfileIds = new Set<string>();
        data.forEach((friendship) => {
          relatedProfileIds.add(friendship.requestor_id);
          relatedProfileIds.add(friendship.addressee_id);
        });
        relatedProfileIds.delete(profile.id);
        if (relatedProfileIds.size > 0) {
          const profileMap = await fetchProfilesByIds(Array.from(relatedProfileIds));
          setProfilesById(profileMap);
        }
      } catch (error: any) {
        console.error("Failed to load friendships", error);
      } finally {
        setLoadingFriends(false);
      }
    };
    loadFriendships();
  }, [profile?.id]);

  const { data: recentImprovements = [] } = useRecentSkillImprovements(profile?.user_id, 24);
  const dashboardNotifications: DashboardNotification[] = [];

  const trackedSkillProgress = useMemo(
    () =>
      Array.isArray(skillProgress)
        ? skillProgress.filter(
            (entry) => typeof entry?.skill_slug === "string" && entry.skill_slug.trim().length > 0,
          )
        : [],
    [skillProgress],
  );

  useEffect(() => {
    if (trackedSkillProgress.length === 0) {
      if (selectedSkill) setSelectedSkill("");
      return;
    }
    if (!selectedSkill) {
      setSelectedSkill(trackedSkillProgress[0].skill_slug);
      return;
    }
    if (!trackedSkillProgress.some((entry) => entry.skill_slug === selectedSkill)) {
      setSelectedSkill(trackedSkillProgress[0].skill_slug);
    }
  }, [trackedSkillProgress, selectedSkill]);

  const xpBalance = useMemo(() => Math.max(0, Number(xpWallet?.xp_balance ?? 0)), [xpWallet]);
  const hasSpendableXp = xpBalance > 0;
  const lifetimeXp = useMemo(
    () => Math.max(0, Number(xpWallet?.lifetime_xp ?? profile?.experience ?? 0)),
    [xpWallet, profile],
  );
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const hasClaimedDailyXp = (dailyXpGrant?.grant_date ?? null) === todayIso;
  const todaysStipend = hasClaimedDailyXp
    ? Math.max(0, Number((dailyXpGrant as any)?.xp_awarded ?? dailyXpGrant?.xp_amount ?? DAILY_XP_STIPEND))
    : DAILY_XP_STIPEND;

  const existingProfileIds = useMemo(() => {
    const ids = new Set<string>();
    friendships.forEach((friendship) => {
      ids.add(friendship.requestor_id);
      ids.add(friendship.addressee_id);
    });
    if (profile?.id) ids.add(profile.id);
    return ids;
  }, [friendships, profile?.id]);

  const { accepted, incoming, outgoing } = useMemo(() => {
    const initial = {
      accepted: [] as DecoratedFriendship[],
      incoming: [] as DecoratedFriendship[],
      outgoing: [] as DecoratedFriendship[],
    };
    if (!profile?.id) return initial;
    return friendships.reduce((accumulator, friendship) => {
      const isRequester = friendship.requestor_id === profile.id;
      const otherProfileId = isRequester ? friendship.addressee_id : friendship.requestor_id;
      const otherProfile = profilesById[otherProfileId] ?? null;
      const decorated: DecoratedFriendship = { friendship, otherProfile, isRequester };
      switch (friendship.status) {
        case "accepted":
          accumulator.accepted.push(decorated);
          break;
        case "pending":
          if (isRequester) accumulator.outgoing.push(decorated);
          else accumulator.incoming.push(decorated);
          break;
      }
      return accumulator;
    }, initial);
  }, [friendships, profile?.id, profilesById]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < MINIMUM_SEARCH_LENGTH) {
      toast({
        title: "Search term too short",
        description: `Enter at least ${MINIMUM_SEARCH_LENGTH} characters.`,
      });
      return;
    }
    if (!profile?.id) return;
    setSearching(true);
    setSearchPerformed(true);
    try {
      const exclusions = Array.from(existingProfileIds);
      const results = await searchProfilesByQuery(query, exclusions);
      setSearchResults(results);
    } catch (error: any) {
      console.error("Friend search failed", error);
      toast({ title: "Search failed", description: error?.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetProfileId: string) => {
    if (!profile?.id) return;
    setActionTarget(targetProfileId);
    try {
      await sendFriendRequest({ requestorProfileId: profile.id, addresseeProfileId: targetProfileId });
      toast({ title: "Friend request sent" });
      setSearchResults((previous) => previous.filter((result) => result.id !== targetProfileId));
      const data = await fetchFriendshipsForProfile(profile.id);
      setFriendships(data);
    } catch (error: any) {
      toast({ title: "Couldn't send request", description: error?.message, variant: "destructive" });
    } finally {
      setActionTarget(null);
    }
  };

  const handleAccept = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await updateFriendshipStatus(friendshipId, "accepted");
      toast({ title: "Friend added" });
      if (profile?.id) {
        const data = await fetchFriendshipsForProfile(profile.id);
        setFriendships(data);
      }
    } catch (error: any) {
      toast({ title: "Unable to accept request", description: error?.message, variant: "destructive" });
    } finally {
      setActionTarget(null);
    }
  };

  const handleDecline = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await updateFriendshipStatus(friendshipId, "declined");
      toast({ title: "Request declined" });
      if (profile?.id) {
        const data = await fetchFriendshipsForProfile(profile.id);
        setFriendships(data);
      }
    } catch (error: any) {
      toast({ title: "Unable to decline", description: error?.message, variant: "destructive" });
    } finally {
      setActionTarget(null);
    }
  };

  const handleRemove = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await deleteFriendship(friendshipId);
      toast({ title: "Friend removed" });
      if (profile?.id) {
        const data = await fetchFriendshipsForProfile(profile.id);
        setFriendships(data);
      }
    } catch (error: any) {
      toast({ title: "Unable to remove friend", description: error?.message, variant: "destructive" });
    } finally {
      setActionTarget(null);
    }
  };

  const handleClaimDailyXp = async () => {
    try {
      setClaimingDailyXp(true);
      await claimDailyXp({ source: "dashboard" });
      toast({ title: "Daily XP collected", description: `Added ${todaysStipend.toLocaleString()} XP.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to claim.";
      toast({ title: "Could not claim daily XP", description: message, variant: "destructive" });
    } finally {
      setClaimingDailyXp(false);
    }
  };

  const handleSpendAttribute = async (attributeKey: string) => {
    const dbKey = ATTRIBUTE_COLUMN_KEY_MAP[attributeKey] ?? attributeKey;
    const requested = attributeXpInputs[attributeKey] ?? DEFAULT_ATTRIBUTE_SPEND;
    const amount = Math.max(1, Math.trunc(Number.isFinite(requested) ? requested : DEFAULT_ATTRIBUTE_SPEND));
    if (amount <= 0) {
      toast({ title: "Enter a positive XP amount", variant: "destructive" });
      return;
    }
    if (xpBalance < amount) {
      toast({ title: "Not enough XP", variant: "destructive" });
      return;
    }
    try {
      setAttributeSpendPending(dbKey);
      await spendAttributeXp({ attributeKey: dbKey, amount, metadata: { source: "dashboard" } });
      toast({ title: "Attribute improved", description: `Invested ${amount.toLocaleString()} XP.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invest XP.";
      toast({ title: "Could not spend XP", description: message, variant: "destructive" });
    } finally {
      setAttributeSpendPending(null);
    }
  };

  const handleSpendSkill = async () => {
    if (!selectedSkill) {
      toast({ title: "Choose a skill", variant: "destructive" });
      return;
    }
    const amount = Math.max(1, Math.trunc(Number.isFinite(skillXpAmount) ? skillXpAmount : DEFAULT_SKILL_SPEND));
    if (amount <= 0) {
      toast({ title: "Enter a positive XP amount", variant: "destructive" });
      return;
    }
    if (xpBalance < amount) {
      toast({ title: "Not enough XP", variant: "destructive" });
      return;
    }
    try {
      setSkillSpendPending(true);
      await spendSkillXp({ skillSlug: selectedSkill, amount, metadata: { source: "dashboard" } });
      toast({ title: "Skill training logged", description: `Invested ${amount.toLocaleString()} XP.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invest XP.";
      toast({ title: "Could not invest XP", description: message, variant: "destructive" });
    } finally {
      setSkillSpendPending(false);
    }
  };

  const displayName = profile?.display_name || profile?.username || "Performer";
  const profileInitials = useMemo(() => {
    const source = displayName;
    if (!source) return "RM";
    return source
      .split(" ")
      .map((segment) => segment.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2) || "RM";
  }, [displayName]);

  const currentCityLabel = useMemo(() => {
    if (!currentCity) return null;
    if (currentCity.country && currentCity.country.trim().length > 0) {
      return `${currentCity.name}, ${currentCity.country}`;
    }
    return currentCity.name ?? null;
  }, [currentCity]);

  const joinedDate = formatDate(profile?.created_at);

  if (gameDataLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Profile Not Found</AlertTitle>
          <AlertDescription>Unable to load your profile data.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 md:p-6 space-y-4">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-xs flex items-center gap-1">
              <Star className="h-3 w-3" />
              Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">Lvl {profile.level || 1}</div>
            <Progress value={(profile.experience || 0) % 100} className="mt-1 h-1" />
            <p className="text-xs text-muted-foreground mt-0.5">{profile.experience || 0} XP</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-xs flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">${profile.cash || 0}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Cash</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-xs flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Fame
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{profile.fame || 0}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Points</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-xs flex items-center gap-1">
              <Users className="h-3 w-3" />
              Online
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{onlinePlayers}</div>
            <p className="text-xs text-muted-foreground mt-0.5">of {totalPlayers}</p>
          </CardContent>
        </Card>

        <CurrentLocationWidget city={currentCity} loading={false} />
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="text-xs md:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="profile" className="text-xs md:text-sm">Profile</TabsTrigger>
          <TabsTrigger value="development" className="text-xs md:text-sm">Skills & Attributes</TabsTrigger>
          <TabsTrigger value="friends" className="text-xs md:text-sm">Friends</TabsTrigger>
          <TabsTrigger value="achievements" className="text-xs md:text-sm">Achievements</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-3 mt-3">
          {/* Schedule, Activity & Chat */}
          <div className="space-y-3 max-w-4xl mx-auto">
            {/* Game Date */}
            <div className="flex justify-center">
              <GameDateWidget />
            </div>

            {/* Today's Schedule */}
            <Collapsible open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="py-2 px-3 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Today's Schedule
                      </CardTitle>
                      {scheduleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-3 max-h-[300px] overflow-y-auto">
                    <DaySchedule date={new Date()} userId={profile.user_id} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Recent Skill Improvements */}
            {recentImprovements.length > 0 && (
              <Collapsible open={skillsOpen} onOpenChange={setSkillsOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="py-2 px-3 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUpIcon className="h-4 w-4" />
                          Skills Improved (24hrs)
                        </CardTitle>
                        {skillsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        {recentImprovements.slice(0, 3).map(improvement => (
                          <div key={improvement.id} className="flex items-center justify-between p-2 rounded bg-accent/50 text-xs">
                            <div>
                              <p className="font-medium">{formatSkillName(improvement.skill_name)}</p>
                              <p className="text-muted-foreground text-[10px]">{improvement.previous_value} → {improvement.new_value}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] h-5">+{improvement.improvement_amount}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Recent Activity */}
            <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Recent Activity
                      </CardTitle>
                      {activityOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-3 max-h-[300px] overflow-y-auto">
                    {activityLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : activityFeed.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
                    ) : (
                      <div className="space-y-2">
                        {activityFeed.slice(0, 5).map(activity => (
                          <div key={activity.id} className="flex items-start gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                            <Activity className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{activity.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNowStrict(new Date(activity.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            {activity.earnings > 0 && (
                              <Badge variant="outline" className="shrink-0">+${activity.earnings}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

              {/* Chat */}
              <Collapsible open={chatOpen} onOpenChange={setChatOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Chat
                        </CardTitle>
                        {chatOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      <Tabs value={currentTab} onValueChange={v => setCurrentTab(v as ChatScope)} className="w-full">
                        <TabsList className="w-full rounded-none h-10 grid grid-cols-2">
                          <TabsTrigger value="general" className="text-sm">General</TabsTrigger>
                          <TabsTrigger value="city" className="text-sm">Local</TabsTrigger>
                        </TabsList>
                        <div className="p-3">
                          <TabsContent value="general" className="m-0 min-h-[250px]">
                            <RealtimeChatPanel channelKey="general" />
                          </TabsContent>
                          <TabsContent value="city" className="m-0 min-h-[250px]">
                            <RealtimeChatPanel channelKey={deriveCityChannel(currentCity?.id)} />
                          </TabsContent>
                        </div>
                      </Tabs>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-3 mt-3">
          <div className="flex justify-center">
            <Card className="w-full max-w-2xl">
              <CardHeader className="pb-3">
                <div className="flex flex-col items-center text-center space-y-4">
                  {/* Profile Picture & Avatar */}
                  <div className="flex gap-6 items-center">
                    {/* Profile Picture */}
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/10 text-3xl font-semibold shadow-lg">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt={displayName} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        profileInitials
                      )}
                    </div>
                    {/* Character Avatar Placeholder */}
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-border bg-muted/50">
                      <Mic className="h-10 w-10 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{displayName}</h2>
                    {profile.username && profile.username !== displayName && (
                      <p className="text-sm text-muted-foreground">@{profile.username}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.bio && (
                  <>
                    <p className="text-muted-foreground text-center">{profile.bio}</p>
                    <Separator />
                  </>
                )}
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                    <Cake className="h-5 w-5 mb-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Age</span>
                    <span className="text-lg font-semibold">{profile.age ?? 16}</span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                    <Users className="h-5 w-5 mb-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Gender</span>
                    <span className="text-sm font-medium capitalize">{(profile as any).gender ?? 'unspecified'}</span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                    <Star className="h-5 w-5 mb-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Fame</span>
                    <span className="text-lg font-semibold">{profile.fame ?? 0}</span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                    <Users className="h-5 w-5 mb-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Fans</span>
                    <span className="text-lg font-semibold">{profile.fans ?? 0}</span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                    <DollarSign className="h-5 w-5 mb-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Cash</span>
                    <span className="text-lg font-semibold">${profile.cash ?? 0}</span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                    <Clock className="h-5 w-5 mb-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Hours Played</span>
                    <span className="text-lg font-semibold">{(profile as any).total_hours_played ?? 0}</span>
                  </div>
                </div>

                <Separator />

                {/* Health & Energy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Health</span>
                    <Badge variant="outline">{profile.health ?? 100}%</Badge>
                  </div>
                  <Progress value={profile.health ?? 100} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Energy</span>
                    <Badge variant="outline">{profile.energy ?? 100}%</Badge>
                  </div>
                  <Progress value={profile.energy ?? 100} className="h-2" />
                </div>

                <Separator />

                {/* Meta Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {currentCityLabel && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>Location: {currentCityLabel}</span>
                    </div>
                  )}
                  {joinedDate && (
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>Joined {joinedDate}</span>
                    </div>
                  )}
                  {profile.updated_at && (
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <span>Last active {formatDistanceToNowStrict(new Date(profile.updated_at), { addSuffix: true })}</span>
                    </div>
                  )}
                </div>

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/my-character/edit">Edit Profile</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Skills & Attributes Tab */}
        <TabsContent value="development" className="space-y-3 mt-3">
          {/* Daily XP */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Daily XP Stipend
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 grid-cols-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Wallet</p>
                  <p className="text-lg font-semibold">{xpBalance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Today</p>
                  <p className="text-lg font-semibold">{todaysStipend.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lifetime</p>
                  <p className="text-lg font-semibold">{lifetimeXp.toLocaleString()}</p>
                </div>
              </div>
              <Button onClick={handleClaimDailyXp} disabled={claimingDailyXp || hasClaimedDailyXp} size="sm" className="w-full">
                {claimingDailyXp && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {hasClaimedDailyXp ? "Claimed" : "Claim XP"}
              </Button>
            </CardContent>
          </Card>

          <CurrentLearningSection />

          {/* Attributes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Core Attributes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attributes ? (
                <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                  {Object.entries(attributes).map(([attributeKey, score]) => {
                    const numericScore = typeof score === "number" ? score : MIN_ATTRIBUTE_SCORE;
                    const displayScore = Math.max(MIN_ATTRIBUTE_SCORE, numericScore);
                    const dbKey = ATTRIBUTE_COLUMN_KEY_MAP[attributeKey] ?? attributeKey;
                    const xpInputValue = attributeXpInputs[attributeKey] ?? DEFAULT_ATTRIBUTE_SPEND;
                    const isProcessing = attributeSpendPending === dbKey;
                    return (
                      <div key={attributeKey} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs">{sanitizeAttributeLabel(attributeKey)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-secondary">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: `${Math.min(100, Math.max(0, ((displayScore - 5) / 995) * 100))}%` }}
                          />
                        </div>
                        {hasSpendableXp && (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={1}
                              value={xpInputValue}
                              onChange={(e) => {
                                const parsed = Number(e.target.value);
                                setAttributeXpInputs((prev) => ({
                                  ...prev,
                                  [attributeKey]: Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0,
                                }));
                              }}
                              className="h-6 w-14 text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSpendAttribute(attributeKey)}
                              disabled={xpInputValue <= 0 || xpBalance < xpInputValue || isProcessing}
                              className="h-6 text-xs px-2"
                            >
                              {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Invest"}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Loading attributes...</p>
              )}
            </CardContent>
          </Card>

          {/* Skills with XP */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Guitar className="h-4 w-4" />
                Skills Progress
              </CardTitle>
              <CardDescription className="text-xs">Skills you've awarded XP to</CardDescription>
            </CardHeader>
            <CardContent>
              {skills && Object.entries(skills).filter(([key, value]) => 
                !['id', 'user_id', 'created_at', 'updated_at'].includes(key) && typeof value === 'number' && value > 0
              ).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(skills)
                    .filter(([key, value]) => 
                      !['id', 'user_id', 'created_at', 'updated_at'].includes(key) && typeof value === 'number' && value > 0
                    )
                    .map(([skillKey, level]) => {
                      const numericLevel = typeof level === 'number' ? level : 0;
                      return (
                        <div key={skillKey} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{formatSkillName(skillKey)}</span>
                            <Badge variant="secondary" className="text-xs">Lvl {numericLevel}</Badge>
                          </div>
                          <div className="h-2 w-full rounded-full bg-secondary">
                            <div
                              className="h-2 rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, (numericLevel / 100) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No skills trained yet. Start training skills through activities!</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Friends Tab */}
        <TabsContent value="friends" className="space-y-3 mt-3">
          {/* Search */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4" />
                Find Players
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button type="submit" size="sm" disabled={searching} className="h-8 text-xs">
                  {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                </Button>
              </form>
              {searchPerformed && searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {searchResults.map((result) => (
                    <div key={result.id} className="flex items-center justify-between p-2 rounded-lg border text-xs">
                      <div>
                        <p className="font-medium">{result.display_name || result.username}</p>
                        {result.username && <p className="text-muted-foreground">@{result.username}</p>}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSendRequest(result.id)}
                        disabled={actionTarget === result.id}
                        className="h-7 text-xs"
                      >
                        {actionTarget === result.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Incoming Requests */}
          {incoming.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Incoming Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {incoming.map(({ friendship, otherProfile }) => (
                    <div key={friendship.id} className="flex items-center justify-between p-2 rounded-lg border text-xs">
                      <p className="font-medium">{otherProfile?.display_name || otherProfile?.username || "Unknown"}</p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleAccept(friendship.id)}
                          disabled={actionTarget === friendship.id}
                          className="h-7 text-xs"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDecline(friendship.id)}
                          disabled={actionTarget === friendship.id}
                          className="h-7 text-xs"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Friends List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Friends ({accepted.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFriends ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : accepted.length === 0 ? (
                <p className="text-xs text-muted-foreground">No friends yet.</p>
              ) : (
                <div className="space-y-2">
                  {accepted.map(({ friendship, otherProfile }) => (
                    <div key={friendship.id} className="flex items-center justify-between p-2 rounded-lg border text-xs">
                      <div>
                        <p className="font-medium">{otherProfile?.display_name || otherProfile?.username || "Unknown"}</p>
                        {otherProfile?.username && <p className="text-muted-foreground">@{otherProfile.username}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemove(friendship.id)}
                        disabled={actionTarget === friendship.id}
                        className="h-7 text-xs"
                      >
                        <UserX className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="mt-3">
          <AchievementsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
