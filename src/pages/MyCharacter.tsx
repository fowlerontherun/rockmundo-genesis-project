import { useCallback, useEffect, useMemo, useState, type ElementType, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Cake,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  MapPin,
  Mic,
  Music,
  Search,
  Sparkles,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGameData, type PlayerProfile } from "@/hooks/useGameData";
import { HealthSection } from "@/components/character/HealthSection";
import { AchievementsSection } from "@/components/character/AchievementsSection";
import { CurrentLearningSection } from "@/components/character/CurrentLearningSection";
import type { Database } from "@/lib/supabase-types";
import {
  deleteFriendship,
  fetchFriendshipsForProfile,
  fetchProfilesByIds,
  searchProfilesByQuery,
  sendFriendRequest,
  updateFriendshipStatus,
} from "@/integrations/supabase/friends";

const formatDate = (input: string | null | undefined) => {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString();
};

const sanitizeAttributeLabel = (label: string) =>
  label
    .replace(/_/g, " ")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const PROFILE_META_FIELDS: Array<{ key: any; label: string; icon: ElementType }> = [
  { key: "current_location", label: "Hometown", icon: MapPin },
  { key: "age", label: "Age", icon: Cake },
  { key: "genre", label: "Primary Genre", icon: Music },
  { key: "fame", label: "Fame", icon: Sparkles },
  { key: "fans", label: "Fans", icon: Users },
];

const MIN_ATTRIBUTE_SCORE = 5;
const DAILY_XP_STIPEND = 150;
const DEFAULT_ATTRIBUTE_SPEND = 10;
const DEFAULT_SKILL_SPEND = 25;

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

const DEFAULT_SKILL_LABEL = "Skill";

const formatSkillLabel = (rawSlug: unknown) => {
  if (typeof rawSlug !== "string") {
    return DEFAULT_SKILL_LABEL;
  }

  const trimmedSlug = rawSlug.trim();
  if (trimmedSlug.length === 0) {
    return DEFAULT_SKILL_LABEL;
  }

  const segments = trimmedSlug
    .split(/[_-]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return trimmedSlug.charAt(0).toUpperCase() + trimmedSlug.slice(1);
  }

  return segments.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(" ");
};

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

interface DecoratedFriendship {
  friendship: FriendshipRow;
  otherProfile: ProfileRow | null;
  isRequester: boolean;
}

const MINIMUM_SEARCH_LENGTH = 2;

const MyCharacter = () => {
  const {
    profile,
    attributes,
    xpWallet,
    skillProgress,
    dailyXpGrant,
    claimDailyXp,
    spendAttributeXp,
    spendSkillXp,
    loading,
    error,
    currentCity,
    activityStatus,
    startActivity,
  } = useGameData();
  const { toast } = useToast();
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

  const loadFriendships = useCallback(async () => {
    const profileId = profile?.id;
    if (!profileId) {
      setFriendships([]);
      setProfilesById({});
      return;
    }

    setLoadingFriends(true);
    try {
      const data = await fetchFriendshipsForProfile(profileId);
      setFriendships(data);

      const relatedProfileIds = new Set<string>();
      data.forEach((friendship) => {
        relatedProfileIds.add(friendship.requester_id);
        relatedProfileIds.add(friendship.addressee_id);
      });
      relatedProfileIds.delete(profileId);

      if (relatedProfileIds.size === 0) {
        setProfilesById({});
        return;
      }

      const profileMap = await fetchProfilesByIds(Array.from(relatedProfileIds));
      setProfilesById(profileMap);
    } catch (error: any) {
      console.error("Failed to load friendships", error);
      toast({
        title: "Unable to load friends",
        description: error?.message ?? "Something went wrong while loading your friendships.",
        variant: "destructive",
      });
    } finally {
      setLoadingFriends(false);
    }
  }, [profile?.id, toast]);

  useEffect(() => {
    if (!profile?.id) {
      setFriendships([]);
      setProfilesById({});
      return;
    }

    void loadFriendships();
  }, [loadFriendships, profile?.id]);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setSearchPerformed(false);
    }
  }, [searchQuery]);

  const existingProfileIds = useMemo(() => {
    const ids = new Set<string>();
    friendships.forEach((friendship) => {
      ids.add(friendship.requester_id);
      ids.add(friendship.addressee_id);
    });
    if (profile?.id) {
      ids.add(profile.id);
    }
    return ids;
  }, [friendships, profile?.id]);

  const { accepted, incoming, outgoing, declined } = useMemo(() => {
    const initial = {
      accepted: [] as DecoratedFriendship[],
      incoming: [] as DecoratedFriendship[],
      outgoing: [] as DecoratedFriendship[],
      declined: [] as DecoratedFriendship[],
    };

    if (!profile?.id) {
      return initial;
    }

    return friendships.reduce((accumulator, friendship) => {
      const isRequester = friendship.requester_id === profile.id;
      const otherProfileId = isRequester ? friendship.addressee_id : friendship.requester_id;
      const otherProfile = profilesById[otherProfileId] ?? null;
      const decorated: DecoratedFriendship = { friendship, otherProfile, isRequester };

      switch (friendship.status) {
        case "accepted":
          accumulator.accepted.push(decorated);
          break;
        case "pending":
          if (isRequester) {
            accumulator.outgoing.push(decorated);
          } else {
            accumulator.incoming.push(decorated);
          }
          break;
        case "declined":
        case "blocked":
          accumulator.declined.push(decorated);
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
        description: `Enter at least ${MINIMUM_SEARCH_LENGTH} characters to search for players.`,
      });
      return;
    }

    if (!profile?.id) {
      return;
    }

    setSearching(true);
    setSearchPerformed(true);
    try {
      const exclusions = Array.from(existingProfileIds);
      const results = await searchProfilesByQuery(query, exclusions);
      setSearchResults(results);
    } catch (error: any) {
      console.error("Friend search failed", error);
      toast({
        title: "Search failed",
        description: error?.message ?? "We couldn't search for players right now.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetProfileId: string) => {
    if (!profile?.id) {
      return;
    }

    setActionTarget(targetProfileId);
    try {
      await sendFriendRequest({
        requesterProfileId: profile.id,
        addresseeProfileId: targetProfileId,
      });
      toast({
        title: "Friend request sent",
        description: "We'll let you know when they respond.",
      });
      setSearchResults((previous) => previous.filter((result) => result.id !== targetProfileId));
      await loadFriendships();
    } catch (error: any) {
      console.error("Failed to send friend request", error);
      toast({
        title: "Couldn't send request",
        description: error?.message ?? "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setActionTarget(null);
    }
  };

  const handleAccept = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await updateFriendshipStatus(friendshipId, "accepted");
      toast({
        title: "Friend added",
        description: "You're now connected. Time to jam!",
      });
      await loadFriendships();
    } catch (error: any) {
      console.error("Failed to accept friend request", error);
      toast({
        title: "Unable to accept request",
        description: error?.message ?? "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setActionTarget(null);
    }
  };

  const handleDecline = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await updateFriendshipStatus(friendshipId, "declined");
      toast({
        title: "Request declined",
        description: "The player has been notified of your decision.",
      });
      await loadFriendships();
    } catch (error: any) {
      console.error("Failed to decline friend request", error);
      toast({
        title: "Unable to decline",
        description: error?.message ?? "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setActionTarget(null);
    }
  };

  const handleCancel = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await deleteFriendship(friendshipId);
      toast({
        title: "Request cancelled",
        description: "You can always send another request later.",
      });
      await loadFriendships();
    } catch (error: any) {
      console.error("Failed to cancel friend request", error);
      toast({
        title: "Unable to cancel",
        description: error?.message ?? "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setActionTarget(null);
    }
  };

  const handleRemove = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await deleteFriendship(friendshipId);
      toast({
        title: "Friend removed",
        description: "They're no longer on your friends list.",
      });
      await loadFriendships();
    } catch (error: any) {
      console.error("Failed to remove friend", error);
      toast({
        title: "Unable to remove friend",
        description: error?.message ?? "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setActionTarget(null);
    }
  };

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
      if (selectedSkill) {
        setSelectedSkill("");
      }
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
  const lifetimeXp = useMemo(
    () => Math.max(0, Number(xpWallet?.lifetime_xp ?? profile?.experience ?? 0)),
    [xpWallet, profile],
  );
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const hasClaimedDailyXp = (dailyXpGrant?.grant_date ?? null) === todayIso;
  const todaysStipend = hasClaimedDailyXp
    ? Math.max(0, Number((dailyXpGrant as any)?.xp_awarded ?? dailyXpGrant?.xp_amount ?? DAILY_XP_STIPEND))
    : DAILY_XP_STIPEND;
  const lastClaimedAtLabel = useMemo(() => {
    if (!(dailyXpGrant as any)?.claimed_at) {
      return null;
    }
    const parsed = new Date((dailyXpGrant as any).claimed_at ?? dailyXpGrant.created_at);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toLocaleString();
  }, [dailyXpGrant]);
  const handleAttributeInputChange = (attributeKey: string, rawValue: string) => {
    const parsed = Number(rawValue);
    const normalized = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
    setAttributeXpInputs((previous) => ({ ...previous, [attributeKey]: normalized }));
  };

  const handleClaimDailyXp = async () => {
    try {
      setClaimingDailyXp(true);
      await claimDailyXp({ source: "my_character" });
      toast({
        title: "Daily XP collected",
        description: `Added ${todaysStipend.toLocaleString()} XP to your wallet.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to claim your stipend right now.";
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
      toast({
        title: "Enter a positive XP amount",
        description: "Add at least 1 XP to invest in this attribute.",
        variant: "destructive",
      });
      return;
    }

    if (xpBalance < amount) {
      toast({
        title: "Not enough XP",
        description: "Claim or earn more XP before investing in this attribute.",
        variant: "destructive",
      });
      return;
    }

    const attributeLabel = sanitizeAttributeLabel(attributeKey);

    try {
      setAttributeSpendPending(dbKey);
      await spendAttributeXp({
        attributeKey: dbKey,
        amount,
        metadata: { source: "my_character" },
      });
      toast({
        title: "Attribute improved",
        description: `Invested ${amount.toLocaleString()} XP into ${attributeLabel}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invest XP into this attribute.";
      toast({ title: "Could not spend XP", description: message, variant: "destructive" });
    } finally {
      setAttributeSpendPending(null);
    }
  };

  const handleSpendSkill = async () => {
    if (!selectedSkill) {
      toast({
        title: "Choose a skill",
        description: "Select a skill before investing XP.",
        variant: "destructive",
      });
      return;
    }

    const amount = Math.max(1, Math.trunc(Number.isFinite(skillXpAmount) ? skillXpAmount : DEFAULT_SKILL_SPEND));

    if (amount <= 0) {
      toast({
        title: "Enter a positive XP amount",
        description: "Add at least 1 XP to invest in your skill.",
        variant: "destructive",
      });
      return;
    }

    if (xpBalance < amount) {
      toast({
        title: "Not enough XP",
        description: "You need more unspent XP to train this skill.",
        variant: "destructive",
      });
      return;
    }

    const skillLabel = formatSkillLabel(selectedSkill);

    try {
      setSkillSpendPending(true);
      await spendSkillXp({
        skillSlug: selectedSkill,
        amount,
        metadata: { source: "my_character" },
      });
      toast({
        title: "Skill training logged",
        description: `Invested ${amount.toLocaleString()} XP into ${skillLabel}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invest XP into this skill.";
      toast({ title: "Could not invest XP", description: message, variant: "destructive" });
    } finally {
      setSkillSpendPending(false);
    }
  };

  const displayName = profile?.display_name || profile?.username || "Performer";

  const profileInitials = useMemo(() => {
    const source = displayName;
    if (!source) {
      return "RM";
    }

    return source
      .split(" ")
      .map((segment) => segment.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2) || "RM";
  }, [displayName]);

  const currentCityLabel = useMemo(() => {
    if (!currentCity) {
      return null;
    }

    if (currentCity.country && currentCity.country.trim().length > 0) {
      return `${currentCity.name}, ${currentCity.country}`;
    }

    return currentCity.name ?? null;
  }, [currentCity]);

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center p-6">
        <p className="text-lg font-semibold">Loading your character...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Unable to load your character</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center p-6">
        <Card className="max-w-lg text-center">
          <CardHeader>
            <CardTitle>Create your artist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-muted-foreground">
            <p>Set up your performer details to unlock the rest of Rockmundo.</p>
            <p className="text-sm">Head to the onboarding flow to choose a name and hometown.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const joinedDate = formatDate(profile.created_at);
  const updatedDate = formatDate(profile.updated_at);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Character</h1>
          <p className="text-muted-foreground">Your artist profile, health, and development.</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-base">
              Level {profile.level ?? 1}
            </Badge>
            {typeof profile.experience === "number" && (
              <Badge variant="secondary" className="text-base">
                {profile.experience.toLocaleString()} XP
              </Badge>
            )}
          </div>
          <Button asChild variant="outline">
            <Link to="/my-character/edit">Edit profile</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="development">Development</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="friends">Friends</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,320px),1fr]">
            <Card>
              <CardHeader className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
                  {profileInitials}
                </div>
                <div className="mt-4 space-y-1">
                  <h2 className="text-2xl font-semibold">{displayName}</h2>
                  {profile.username && profile.username !== displayName && (
                    <p className="text-sm text-muted-foreground">@{profile.username}</p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.bio ? (
                  <p className="text-sm text-muted-foreground">{profile.bio}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Add a bio to share your origin story.</p>
                )}

                <Separator />

                <div className="space-y-3 text-sm">
                  {PROFILE_META_FIELDS.map(({ key, label, icon: Icon }) => {
                    const value = profile[key];

                    if (value === null || value === undefined || value === "") {
                      return null;
                    }

                    return (
                      <div key={key as string} className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{label}:</span>
                        <span className="text-muted-foreground">{String(value)}</span>
                      </div>
                    );
                  })}
                  {currentCityLabel && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Current City:</span>
                      <span className="text-muted-foreground">{currentCityLabel}</span>
                    </div>
                  )}
                  {joinedDate && (
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Joined:</span>
                      <span className="text-muted-foreground">{joinedDate}</span>
                    </div>
                  )}
                  {updatedDate && (
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Last Active:</span>
                      <span className="text-muted-foreground">{updatedDate}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Health</span>
                  <Badge>{profile.health ?? 100}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Energy</span>
                  <Badge>{profile.energy ?? 100}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cash</span>
                  <Badge>${profile.cash?.toLocaleString() ?? 0}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="development" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Daily XP Stipend
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Claim your daily XP and invest it into attributes or skills below.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Wallet balance</p>
                  <p className="text-2xl font-semibold">{xpBalance.toLocaleString()} XP</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Today's stipend</p>
                  <p className="text-2xl font-semibold">{todaysStipend.toLocaleString()} XP</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Lifetime XP</p>
                  <p className="text-2xl font-semibold">{lifetimeXp.toLocaleString()} XP</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {hasClaimedDailyXp
                    ? `You've already claimed today's stipend${lastClaimedAtLabel ? ` (${lastClaimedAtLabel})` : ""}.`
                    : "You have a fresh XP stipend waiting to be claimed."}
                </div>
                <Button onClick={handleClaimDailyXp} disabled={claimingDailyXp || hasClaimedDailyXp}>
                  {claimingDailyXp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {hasClaimedDailyXp ? "Stipend claimed" : "Claim daily XP"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <CurrentLearningSection />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px),1fr]">
        <Card>
          <CardHeader className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
              {profileInitials}
            </div>
            <div className="mt-4 space-y-1">
              <h2 className="text-2xl font-semibold">{displayName}</h2>
              {profile.username && profile.username !== displayName && (
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.bio ? (
              <p className="text-sm text-muted-foreground">{profile.bio}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Add a bio to share your origin story.</p>
            )}

            <Separator />

            <div className="space-y-3 text-sm">
              {PROFILE_META_FIELDS.map(({ key, label, icon: Icon }) => {
                const value = profile[key];

                if (value === null || value === undefined || value === "") {
                  return null;
                }

                return (
                  <div key={key as string} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{label}:</span>
                    <span className="text-muted-foreground">{String(value)}</span>
                  </div>
                );
              })}
              {currentCityLabel && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Current City:</span>
                  <span className="text-muted-foreground">{currentCityLabel}</span>
                </div>
              )}
              {joinedDate && (
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Joined:</span>
                  <span className="text-muted-foreground">{joinedDate}</span>
                </div>
              )}
              {updatedDate && (
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Last Active:</span>
                  <span className="text-muted-foreground">{updatedDate}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Core Attributes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attributes ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(attributes).map(([attributeKey, score]) => {
                  const numericScore = typeof score === "number" ? score : MIN_ATTRIBUTE_SCORE;
                  const displayScore = Math.max(MIN_ATTRIBUTE_SCORE, numericScore);
                  const dbKey = ATTRIBUTE_COLUMN_KEY_MAP[attributeKey] ?? attributeKey;
                  const xpInputValue = attributeXpInputs[attributeKey] ?? DEFAULT_ATTRIBUTE_SPEND;
                  const attributeButtonDisabled =
                    xpBalance <= 0 || xpInputValue <= 0 || xpBalance < xpInputValue;
                  const isProcessing = attributeSpendPending === dbKey;

                  return (
                    <div key={attributeKey} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{sanitizeAttributeLabel(attributeKey)}</span>
                        <Badge variant="secondary">{displayScore}</Badge>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, ((displayScore - 5) / (1000 - 5)) * 100))}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={xpInputValue}
                          onChange={(event) => handleAttributeInputChange(attributeKey, event.target.value)}
                          className="h-9 w-20"
                          aria-label={`XP to invest in ${sanitizeAttributeLabel(attributeKey)}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSpendAttribute(attributeKey)}
                          disabled={attributeButtonDisabled || isProcessing}
                        >
                          {isProcessing && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                          Spend XP
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Attribute data will appear here once your character is set up.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Skill Training
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Allocate XP to level up the skills you practise the most.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {trackedSkillProgress.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="skill-select">Skill</Label>
                  <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                    <SelectTrigger id="skill-select">
                      <SelectValue placeholder="Choose a skill" />
                    </SelectTrigger>
                    <SelectContent>
                      {trackedSkillProgress.map((skill) => (
                        <SelectItem key={skill.id} value={skill.skill_slug}>
                          {formatSkillLabel(skill.skill_slug)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="skill-xp">XP to invest</Label>
                  <Input
                    id="skill-xp"
                    type="number"
                    min={1}
                    value={skillXpAmount}
                    onChange={(event) => setSkillXpAmount(Math.max(0, Math.trunc(Number(event.target.value))))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {selectedSkill
                    ? `Current level: ${
                        trackedSkillProgress.find((entry) => entry.skill_slug === selectedSkill)?.current_level ?? 1
                      }`
                    : "Select a skill to see its current level."}
                </div>
                <Button onClick={handleSpendSkill} disabled={skillSpendPending || xpBalance <= 0}>
                  {skillSpendPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Invest XP
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {trackedSkillProgress.map((skill) => (
                  <div key={skill.id} className="rounded-lg border bg-muted/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{formatSkillLabel(skill.skill_slug)}</p>
                      <Badge variant="secondary">Level {skill.current_level ?? 1}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {`XP: ${Math.max(0, skill.current_xp ?? 0).toLocaleString()}`}
                      {skill.required_xp ? ` / ${Math.max(0, skill.required_xp).toLocaleString()}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Start practising to track skill growth and invest XP here.</p>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="friends" className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find new friends
          </CardTitle>
          <CardDescription>Search by username or stage name to send friend requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search players by username or display name"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={searching || searchQuery.trim().length < MINIMUM_SEARCH_LENGTH}>
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" /> Search
                </>
              )}
            </Button>
          </form>

          {searchResults.length > 0 ? (
            <div className="grid gap-3">
              {searchResults.map((result) => (
                <Card key={result.id} className="border-border/80">
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{result.display_name ?? result.username}</span>
                        <Badge variant="outline">@{result.username}</Badge>
                      </div>
                      {result.bio ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{result.bio}</p>
                      ) : null}
                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        {typeof result.level === "number" && <span>Level {result.level}</span>}
                        {typeof result.fame === "number" && <span>Fame {result.fame}</span>}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => handleSendRequest(result.id)}
                      disabled={actionTarget === result.id}
                    >
                      {actionTarget === result.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" /> Send request
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : searchPerformed ? (
            <p className="text-sm text-muted-foreground">No players matched your search. Try another name or handle.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter at least {MINIMUM_SEARCH_LENGTH} characters to search for other performers.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="friends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="friends" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Friends
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Requests
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends">
          <Card>
            <CardHeader>
              <CardTitle>Current friends</CardTitle>
              <CardDescription>Accepted friendships appear here. Remove a friend at any time.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingFriends ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : accepted.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                  You haven't accepted any friends yet. Send a few requests to start building your network.
                </div>
              ) : (
                <div className="grid gap-3">
                  {accepted.map(({ friendship, otherProfile }) => (
                    <Card key={friendship.id} className="border-border/80">
                      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {otherProfile?.display_name ?? otherProfile?.username ?? "Former friend"}
                            </span>
                            {otherProfile?.username && <Badge variant="outline">@{otherProfile.username}</Badge>}
                          </div>
                          {otherProfile?.bio ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{otherProfile.bio}</p>
                          ) : null}
                          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                            {typeof otherProfile?.level === "number" && <span>Level {otherProfile.level}</span>}
                            {typeof otherProfile?.fame === "number" && <span>Fame {otherProfile.fame}</span>}
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => handleRemove(friendship.id)}
                          disabled={actionTarget === friendship.id}
                        >
                          {actionTarget === friendship.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <UserX className="mr-2 h-4 w-4" /> Remove friend
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Incoming requests</CardTitle>
                <CardDescription>Accept or decline players who want to connect with you.</CardDescription>
              </CardHeader>
              <CardContent>
                {incoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You're all caught up. When someone sends a request it'll appear here.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {incoming.map(({ friendship, otherProfile }) => (
                      <Card key={friendship.id} className="border-border/80">
                        <CardContent className="flex flex-col gap-3 py-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {otherProfile?.display_name ?? otherProfile?.username ?? "Unknown performer"}
                              </span>
                              {otherProfile?.username && <Badge variant="outline">@{otherProfile.username}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Requested {new Date(friendship.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                            <Button
                              className="flex-1"
                              onClick={() => handleAccept(friendship.id)}
                              disabled={actionTarget === friendship.id}
                            >
                              {actionTarget === friendship.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="mr-2 h-4 w-4" /> Accept
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleDecline(friendship.id)}
                              disabled={actionTarget === friendship.id}
                            >
                              {actionTarget === friendship.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <X className="mr-2 h-4 w-4" /> Decline
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outgoing requests</CardTitle>
                <CardDescription>Requests you've sent that are still pending.</CardDescription>
              </CardHeader>
              <CardContent>
                {outgoing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You haven't sent any friend requests yet. Search for players to start building your crew.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {outgoing.map(({ friendship, otherProfile }) => (
                      <Card key={friendship.id} className="border-border/80">
                        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {otherProfile?.display_name ?? otherProfile?.username ?? "Unknown performer"}
                              </span>
                              {otherProfile?.username && <Badge variant="outline">@{otherProfile.username}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Sent {new Date(friendship.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => handleCancel(friendship.id)}
                            disabled={actionTarget === friendship.id}
                          >
                            {actionTarget === friendship.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <X className="mr-2 h-4 w-4" /> Cancel request
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Request history</CardTitle>
              <CardDescription>Recently declined or blocked requests are listed for reference.</CardDescription>
            </CardHeader>
            <CardContent>
              {declined.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No declined requests at the moment. Keep exploring to meet more performers.
                </p>
              ) : (
                <div className="grid gap-3">
                  {declined.map(({ friendship, otherProfile, isRequester }) => (
                    <Card key={friendship.id} className="border-border/80">
                      <CardContent className="py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {otherProfile?.display_name ?? otherProfile?.username ?? "Unknown performer"}
                            </span>
                            {otherProfile?.username && <Badge variant="outline">@{otherProfile.username}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isRequester ? "You" : "They"} closed this request on {new Date(friendship.updated_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Status: {friendship.status === "blocked" ? "Blocked" : "Declined"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </TabsContent>

    <TabsContent value="health" className="space-y-6 mt-6">
      <HealthSection
        profile={profile}
        attributes={attributes}
        activityStatus={activityStatus}
        startActivity={startActivity}
      />
    </TabsContent>

    <TabsContent value="achievements" className="space-y-6 mt-6">
      <AchievementsSection />
    </TabsContent>
  </Tabs>
    </div>
  );
};

export default MyCharacter;
