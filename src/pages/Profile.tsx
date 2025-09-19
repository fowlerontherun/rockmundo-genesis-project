import { useState, useEffect, useCallback, useMemo, useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CharacterSelect from "@/components/CharacterSelect";
import AvatarWithClothing from "@/components/avatar/AvatarWithClothing";
import {
  User,
  Camera,
  Save,
  Star,
  Trophy,
  Music,
  Users,
  DollarSign,
  Upload,
  Edit3,
  TrendingUp,
  Heart,
  RotateCcw,
  Loader2,
  Sparkles,
  ArrowRight,
  UserPlus,
  UserMinus,
  UserCheck,
  Check,
  X
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData, type PlayerAttributes, type PlayerSkills } from "@/hooks/useGameData";
import { useEquippedClothing } from "@/hooks/useEquippedClothing";
import { useFriendships, type FriendProfileSummary } from "@/hooks/useFriendships";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import { searchProfiles, type SearchProfilesRow } from "@/integrations/supabase/profileSearch";
import { sendFriendRequest } from "@/integrations/supabase/friends";
import { getStoredAvatarPreviewUrl } from "@/utils/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

interface FanMetrics {
  total_fans: number | null;
  weekly_growth: number | null;
  engagement_rate: number | null;
  updated_at: string | null;
}

type ProfileGender = Database["public"]["Enums"]["profile_gender"];
type FriendPresenceStatus = Database["public"]["Enums"]["chat_participant_status"];

type CityOption = {
  id: string;
  name: string | null;
  country: string | null;
};

type ProfileFormState = {
  display_name: string;
  username: string;
  bio: string;
  gender: ProfileGender;
  age: string;
  city_of_birth: string | null;
};

const instrumentSkillKeys: (keyof PlayerSkills)[] = [
  "vocals",
  "guitar",
  "drums",
  "bass",
  "performance",
  "songwriting",
  "composition"
];

const attributeKeys: (keyof PlayerAttributes)[] = [
  "creativity",
  "business",
  "marketing",
  "technical"
];

const genderOptions: { value: ProfileGender; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const NO_CITY_SELECTED_VALUE = "__no_city_selected__";

const Profile = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    profile,
    skills,
    attributes,
    updateProfile,
    freshWeeklyBonusAvailable,
    xpLedger,
    xpWallet,
    resetCharacter,
    refetch,
  } = useGameData();
  const { items: equippedClothing } = useEquippedClothing();

  type MusicalSkill = { key: keyof PlayerSkills; value: number };

  const musicalSkills = useMemo<MusicalSkill[]>(() => {
    if (!skills) {
      return [];
    }

    return instrumentSkillKeys
      .map(skillKey => ({
        key: skillKey,
        value: Number(skills[skillKey] ?? 0)
      }))
      .filter(skill => Number.isFinite(skill.value) && skill.value >= 1);
  }, [skills]);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [fanMetrics, setFanMetrics] = useState<FanMetrics | null>(null);
  const [formData, setFormData] = useState<ProfileFormState>({
    display_name: "",
    username: "",
    bio: "",
    gender: "prefer_not_to_say",
    age: "16",
    city_of_birth: null,
  });
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [friendSearchTerm, setFriendSearchTerm] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<SearchProfilesRow[]>([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState<string | null>(null);
  const [sendingFriendRequestTo, setSendingFriendRequestTo] = useState<string | null>(null);
  const [requestedFriendUserIds, setRequestedFriendUserIds] = useState<Record<string, boolean>>({});
  const friendSearchRequestId = useRef(0);

  const {
    loading: friendsLoading,
    error: friendsError,
    incomingRequests,
    outgoingRequests,
    acceptedFriends,
    presenceByUserId,
    acceptFriendship,
    declineFriendship,
  } = useFriendships(user?.id);

  const getFriendDisplayName = (friendProfile?: FriendProfileSummary) => {
    if (!friendProfile) {
      return "Unknown performer";
    }

    const label = friendProfile.displayName && friendProfile.displayName.trim().length > 0
      ? friendProfile.displayName
      : friendProfile.username;

    return label && label.trim().length > 0 ? label : "Unknown performer";
  };

  const getFriendInitials = (friendProfile?: FriendProfileSummary) => {
    const label = getFriendDisplayName(friendProfile);
    const initials = label
      .split(" ")
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);

    return initials || "RM";
  };

  const presenceLabel = (status?: FriendPresenceStatus) => {
    if (!status) {
      return "Offline";
    }

    if (status === "typing") {
      return "Typing";
    }

    if (status === "muted") {
      return "Do not disturb";
    }

    return "Online";
  };

  const presenceBadgeStyles = (status?: FriendPresenceStatus) => {
    if (status === "typing" || status === "online") {
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-500";
    }

    if (status === "muted") {
      return "border-amber-500/40 bg-amber-500/10 text-amber-500";
    }

    return "border-muted-foreground/20 bg-muted/40 text-muted-foreground";
  };

  const isPresenceOnline = (status?: FriendPresenceStatus) => status === "online" || status === "typing";

  const showFriendshipError = (fallback: string, error: unknown) => {
    const message = error instanceof Error ? error.message : fallback;
    toast({
      variant: "destructive",
      title: "Error",
      description: message === fallback ? fallback : `${fallback}: ${message}`,
    });
  };

  const handleAcceptFriendship = async (friendshipId: string) => {
    try {
      await acceptFriendship(friendshipId);
      toast({
        title: "Friend request accepted",
        description: "You're now connected.",
      });
    } catch (error) {
      showFriendshipError("Could not accept friend request", error);
    }
  };

  const handleDeclineFriendship = async (friendshipId: string) => {
    try {
      await declineFriendship(friendshipId);
      toast({
        title: "Request declined",
        description: "The invitation has been dismissed.",
      });
    } catch (error) {
      showFriendshipError("Could not decline friend request", error);
    }
  };

  const handleCancelFriendship = async (friendshipId: string) => {
    try {
      await declineFriendship(friendshipId);
      toast({
        title: "Request cancelled",
        description: "We've let them know you changed your mind.",
      });
    } catch (error) {
      showFriendshipError("Could not cancel friend request", error);
    }
  };

  const showProfileDetails = Boolean(profile && skills && attributes);

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const toNumber = (value: unknown, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      return fallback;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const formatLedgerEvent = (eventType: string) => {
    if (!eventType) {
      return "XP adjustment";
    }

    if (eventType === "weekly_bonus") {
      return "Weekly bonus";
    }

    return eventType
      .split("_")
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  };

  const latestWeeklyBonus = xpLedger.find(entry => entry.event_type === "weekly_bonus");
  const latestWeeklyMetadata = (latestWeeklyBonus?.metadata as Record<string, unknown> | null) ?? null;
  const weeklyBonusAmount = latestWeeklyBonus
    ? toNumber(latestWeeklyMetadata?.bonus_awarded ?? latestWeeklyBonus.xp_delta ?? 0, 0)
    : 0;
  const weeklyBonusSourceXp = latestWeeklyMetadata ? toNumber(latestWeeklyMetadata?.experience_gained, 0) : 0;
  const weeklyBonusStreak = latestWeeklyBonus ? Math.max(toNumber(latestWeeklyMetadata?.streak, 1), 1) : 0;
  const weeklyBonusRecorded = parseDate(latestWeeklyBonus?.created_at ?? null);
  const formattedWeeklyBonusRecorded = weeklyBonusRecorded
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(weeklyBonusRecorded)
    : null;
  const recentLedgerEntries = xpLedger.slice(0, 5);
  const xpBalance = Math.max(0, Number(xpWallet?.xp_balance ?? 0));
  const lifetimeXp = Math.max(0, Number(xpWallet?.lifetime_xp ?? 0));
  const experienceTowardsNextLevel = lifetimeXp % 1000;
  const levelProgressPercent = Math.min(100, (experienceTowardsNextLevel / 1000) * 100);
  const formattedLifetimeXp = lifetimeXp.toLocaleString();
  const formattedXpBalance = xpBalance.toLocaleString();
  const formattedXpTowardsNextLevel = experienceTowardsNextLevel.toLocaleString();

  useEffect(() => {
    if (!showProfileDetails) {
      setIsEditing(false);
    }
  }, [showProfileDetails]);

  const fetchFanMetrics = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('fan_demographics')
        .select('total_fans, weekly_growth, engagement_rate, updated_at')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setFanMetrics(null);
          return;
        }
        throw error;
      }

      setFanMetrics(data as FanMetrics);
    } catch (err) {
      console.error('Error fetching fan metrics:', err);
    }
  }, [user]);

  const executeFriendSearch = useCallback(
    async (term: string) => {
      friendSearchRequestId.current += 1;
      const requestId = friendSearchRequestId.current;

      if (!user) {
        if (requestId === friendSearchRequestId.current) {
          setFriendSearchResults([]);
          setFriendSearchError(null);
          setFriendSearchLoading(false);
        }
        return;
      }

      const trimmed = term.trim();

      if (trimmed.length === 0) {
        if (requestId === friendSearchRequestId.current) {
          setFriendSearchResults([]);
          setFriendSearchError(null);
          setFriendSearchLoading(false);
        }
        return;
      }

      setFriendSearchLoading(true);
      setFriendSearchError(null);

      try {
        const results = await searchProfiles(trimmed);

        if (requestId !== friendSearchRequestId.current) {
          return;
        }

        const filtered = results.filter(result => result.user_id !== user.id);
        setFriendSearchResults(filtered);
      } catch (error) {
        if (requestId !== friendSearchRequestId.current) {
          return;
        }

        const message =
          error instanceof Error && error.message
            ? error.message
            : "Failed to search for players.";

        setFriendSearchError(message);
        toast({
          variant: "destructive",
          title: "Search failed",
          description: message,
        });
      } finally {
        if (requestId === friendSearchRequestId.current) {
          setFriendSearchLoading(false);
        }
      }
    },
    [toast, user],
  );

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        username: profile.username || "",
        bio: profile.bio || "",
        gender: (profile.gender as ProfileGender) || "prefer_not_to_say",
        age: typeof profile.age === "number" ? String(profile.age) : "16",
        city_of_birth: profile.city_of_birth ?? null,
      });
    }
  }, [profile]);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setCityLoading(true);
        setCityError(null);

        const { data, error } = await supabase
          .from("cities")
          .select("id, name, country")
          .order("name", { ascending: true });

        if (error) throw error;

        const sanitizedCities = ((data as CityOption[] | null) ?? []).filter(
          (city): city is CityOption => typeof city.id === "string" && city.id.trim().length > 0,
        );

        setCityOptions(sanitizedCities);
      } catch (error) {
        console.error("Error loading cities:", error);
        setCityError("We couldn't load cities right now. You can try again later.");
      } finally {
        setCityLoading(false);
      }
    };

    void fetchCities();
  }, []);

  const birthCityLabel = useMemo(() => {
    if (!profile?.city_of_birth) return null;
    const match = cityOptions.find((city) => city.id === profile.city_of_birth);
    if (!match) return null;
    const cityName = match.name ?? "Unnamed City";
    return match.country ? `${cityName}, ${match.country}` : cityName;
  }, [profile?.city_of_birth, cityOptions]);

  const profileGenderLabel = useMemo(() => {
    if (!profile?.gender) return "Prefer not to say";
    return (
      genderOptions.find((option) => option.value === (profile.gender as ProfileGender))?.label ??
      "Prefer not to say"
    );
  }, [profile?.gender]);

  const profileAvatarPreview = useMemo(
    () => getStoredAvatarPreviewUrl(profile?.avatar_url ?? null),
    [profile?.avatar_url],
  );

  useEffect(() => {
    if (!user) {
      setFanMetrics(null);
      return;
    }

    fetchFanMetrics();
  }, [user, fetchFanMetrics]);

  useEffect(() => {
    const handler = setTimeout(() => {
      void executeFriendSearch(friendSearchTerm);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [friendSearchTerm, executeFriendSearch]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-fan-metrics-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fan_demographics',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchFanMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'social_posts',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchFanMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const activityType = (payload.new as { activity_type?: string })?.activity_type;
          if (activityType === 'campaign') {
            fetchFanMetrics();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, fetchFanMetrics]);

  const handleSave = async () => {
    if (!user) return;

    const parsedAge = Number.parseInt(formData.age, 10);
    if (!Number.isFinite(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      toast({
        variant: "destructive",
        title: "Invalid age",
        description: "Age must be between 13 and 120 to keep your persona grounded.",
      });
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        display_name: formData.display_name,
        username: formData.username,
        bio: formData.bio,
        gender: formData.gender,
        age: parsedAge,
        city_of_birth: formData.city_of_birth,
      });
      setIsEditing(false);
      toast({
        title: "Profile Updated!",
        description: "Your profile has been successfully updated.",
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to update profile";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error updating profile:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendFriendRequest = useCallback(
    async (target: SearchProfilesRow) => {
      if (!user || !profile) {
        toast({
          variant: "destructive",
          title: "Profile unavailable",
          description: "You need an active character to send friend requests.",
        });
        return;
      }

      if (target.user_id === user.id) {
        toast({
          variant: "destructive",
          title: "Cannot send request",
          description: "You can't send a friend request to yourself.",
        });
        return;
      }

      const requestKey = target.user_id;
      setSendingFriendRequestTo(requestKey);

      try {
        await sendFriendRequest({
          senderProfileId: profile.id,
          senderUserId: user.id,
          recipientProfileId: target.profile_id,
          recipientUserId: target.user_id,
        });

        setRequestedFriendUserIds((previous) => ({ ...previous, [requestKey]: true }));

        toast({
          title: "Friend request sent",
          description: `Waiting for ${target.display_name ?? target.username} to respond.`,
        });
      } catch (error) {
        const fallbackMessage = "Failed to send friend request. Please try again.";
        const rawMessage = error instanceof Error && error.message ? error.message : fallbackMessage;
        const normalized = rawMessage.toLowerCase();
        const duplicateRequest =
          normalized.includes("friend_requests_pending_pair_idx") ||
          normalized.includes("duplicate key value");

        if (duplicateRequest) {
          setRequestedFriendUserIds((previous) => ({ ...previous, [requestKey]: true }));
        }

        toast({
          variant: duplicateRequest ? "default" : "destructive",
          title: duplicateRequest ? "Request already sent" : "Unable to send friend request",
          description: duplicateRequest
            ? "Wait for your friend to respond before sending another invite."
            : rawMessage,
        });
      } finally {
        setSendingFriendRequestTo((current) => (current === requestKey ? null : current));
      }
    },
    [profile, toast, user],
  );

  const handleFriendSearchInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFriendSearchTerm(event.target.value);
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      await updateProfile({ avatar_url: data.publicUrl });

      toast({
        title: "Avatar Updated!",
        description: "Your profile picture has been successfully updated.",
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to upload avatar";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error uploading avatar:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleResetCharacter = async () => {
    if (isResetting) return;

    setIsResetting(true);
    try {
      await resetCharacter();
      await refetch();
      setIsResetDialogOpen(false);
      toast({
        title: "Character reset",
        description: "Your performer has been restored to their starting stats.",
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to reset character";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error("Error resetting character:", errorMessage, error);
      toast({
        variant: "destructive",
        title: "Reset failed",
        description:
          errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setIsResetting(false);
    }
  };

  const totalFansValue = fanMetrics?.total_fans ?? 0;
  const weeklyGrowthValue = fanMetrics?.weekly_growth ?? 0;
  const weeklyGrowthDisplay = `${weeklyGrowthValue >= 0 ? '+' : ''}${Math.abs(weeklyGrowthValue).toLocaleString()}`;
  const weeklyGrowthClass = weeklyGrowthValue >= 0 ? 'text-success' : 'text-destructive';
  const engagementRateValue = fanMetrics?.engagement_rate ?? 0;
  const engagementRateDisplay = Number.isFinite(engagementRateValue)
    ? Number(engagementRateValue).toFixed(1).replace(/\.0$/, '')
    : '0';
  const lastUpdatedLabel = fanMetrics?.updated_at ? new Date(fanMetrics.updated_at).toLocaleString() : null;

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Player Profile
            </h1>
            <p className="text-muted-foreground">Manage your musical identity</p>
          </div>
          {showProfileDetails && (
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant={isEditing ? "outline" : "default"}
              className={isEditing ? "" : "bg-gradient-primary"}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              {isEditing ? "Cancel" : "Edit Profile"}
            </Button>
          )}
        </div>

        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Character Management
            </CardTitle>
            <CardDescription>
              Switch between unlocked performers or purchase additional character slots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CharacterSelect />
          </CardContent>
        </Card>

        {showProfileDetails ? (
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="profile">Profile Info</TabsTrigger>
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center space-y-4">
                    <AvatarWithClothing
                      avatarUrl={profile.avatar_url}
                      fallbackText={profile.display_name || profile.username}
                      items={equippedClothing}
                      size={128}
                    >
                      <div className="absolute bottom-0 right-0">
                        <label htmlFor="avatar-upload" className="cursor-pointer">
                          <div className="bg-primary hover:bg-primary/80 rounded-full p-2 border-2 border-background">
                            {uploading ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                            ) : (
                              <Camera className="h-4 w-4 text-primary-foreground" />
                            )}
                          </div>
                          <input
                            id="avatar-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    </AvatarWithClothing>
                    <div className="text-center space-y-1">
                      <h2 className="text-2xl font-bold">{profile.display_name || profile.username}</h2>
                      <p className="text-muted-foreground">@{profile.username}</p>
                      <div className="flex items-center gap-2 justify-center mt-2">
                        <Badge variant="outline" className="border-primary text-primary">
                          Level {profile.level || 1}
                        </Badge>
                        <Badge variant="outline" className="border-accent text-accent">
                          {profile.fame || 0} Fame
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="border-border text-foreground/80">
                          Age {profile.age ?? 16}
                        </Badge>
                        <Badge variant="outline" className="border-border text-foreground/80">
                          {profileGenderLabel}
                        </Badge>
                        <Badge variant="outline" className="border-border text-foreground/80">
                          {profile.city_of_birth
                            ? birthCityLabel ?? "Loading birth city..."
                            : "Birth city not set"}
                        </Badge>
                      </div>
                      <AlertDialog
                        open={isResetDialogOpen}
                        onOpenChange={(open) => {
                          if (!isResetting) {
                            setIsResetDialogOpen(open);
                          }
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="mt-4 w-full"
                            disabled={isResetting}
                          >
                            {isResetting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Resetting...
                              </>
                            ) : (
                              <>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset Character
                              </>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset your character?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will restore your current performer to their initial stats and remove
                              progress. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetCharacter} disabled={isResetting}>
                              {isResetting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Resetting...
                                </>
                              ) : (
                                "Confirm Reset"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input
                          id="displayName"
                          value={formData.display_name}
                          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                          disabled={!isEditing}
                          className={!isEditing ? "bg-secondary/50" : ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          disabled={!isEditing}
                          className={!isEditing ? "bg-secondary/50" : ""}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        disabled={!isEditing}
                        className={!isEditing ? "bg-secondary/50" : ""}
                        placeholder="Tell the world about your musical journey..."
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, gender: value as ProfileGender }))
                          }
                          disabled={!isEditing}
                        >
                          <SelectTrigger id="gender" className={!isEditing ? "bg-secondary/50" : ""}>
                            <SelectValue placeholder="Select a gender" />
                          </SelectTrigger>
                          <SelectContent>
                            {genderOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="age">Age</Label>
                        <Input
                          id="age"
                          type="number"
                          min={13}
                          max={120}
                          value={formData.age}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, age: event.target.value }))
                          }
                          disabled={!isEditing}
                          className={!isEditing ? "bg-secondary/50" : ""}
                        />
                        <p className="text-xs text-muted-foreground">Age helps us tailor narrative beats.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city-of-birth">City of Birth</Label>
                        <Select
                          value={formData.city_of_birth ?? NO_CITY_SELECTED_VALUE}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              city_of_birth: value === NO_CITY_SELECTED_VALUE ? null : value,
                            }))
                          }
                          disabled={!isEditing || cityLoading}
                        >
                          <SelectTrigger
                            id="city-of-birth"
                            className={!isEditing ? "bg-secondary/50" : ""}
                          >
                            <SelectValue
                              placeholder={cityLoading ? "Loading cities..." : "Select a city"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_CITY_SELECTED_VALUE}>No listed city</SelectItem>
                            {cityOptions.map((city) => (
                              <SelectItem key={city.id} value={city.id}>
                                {city.name ?? "Unnamed City"}
                                {city.country ? `, ${city.country}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {cityError && <p className="text-xs text-destructive">{cityError}</p>}
                      </div>
                    </div>
                    {isEditing && (
                      <div className="flex gap-2 pt-4">
                        <Button 
                          onClick={handleSave}
                          disabled={saving}
                          className="bg-gradient-primary"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {saving ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button 
                          onClick={() => setIsEditing(false)}
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            </TabsContent>

            <TabsContent value="friends" className="space-y-6">
              {friendsError && (
                <Alert variant="destructive">
                  <AlertTitle>Unable to load friends</AlertTitle>
                  <AlertDescription>{friendsError}</AlertDescription>
                </Alert>
              )}

              {friendsLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Syncing your social circle...</span>
                </div>
              )}

              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    Incoming requests
                    <Badge variant="secondary">{incomingRequests.length}</Badge>
                  </CardTitle>
                  <CardDescription>Approve performers who want to connect with you.</CardDescription>
                </CardHeader>
                <CardContent>
                  {incomingRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">You don't have any pending friend requests right now.</p>
                  ) : (
                    <div className="space-y-4">
                      {incomingRequests.map(request => (
                        <div
                          key={request.friendshipId}
                          className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-secondary/40 p-4 sm:flex-row sm:items-center"
                        >
                          <div className="flex items-center gap-3 sm:flex-1">
                            <Avatar className="h-12 w-12">
                              {request.profile?.avatarUrl ? (
                                <AvatarImage
                                  src={request.profile.avatarUrl}
                                  alt={`${getFriendDisplayName(request.profile)} avatar`}
                                />
                              ) : (
                                <AvatarFallback>{getFriendInitials(request.profile)}</AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <p className="font-semibold">{getFriendDisplayName(request.profile)}</p>
                              <p className="text-sm text-muted-foreground">
                                @{request.profile?.username ?? "unknown"}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 sm:ml-auto">
                            <Button
                              size="sm"
                              className="bg-gradient-primary"
                              onClick={() => {
                                void handleAcceptFriendship(request.friendshipId);
                              }}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                void handleDeclineFriendship(request.friendshipId);
                              }}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserMinus className="h-5 w-5 text-primary" />
                    Outgoing requests
                    <Badge variant="secondary">{outgoingRequests.length}</Badge>
                  </CardTitle>
                  <CardDescription>Requests you've sent and are waiting on.</CardDescription>
                </CardHeader>
                <CardContent>
                  {outgoingRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending requests from you at the moment.</p>
                  ) : (
                    <div className="space-y-4">
                      {outgoingRequests.map(request => (
                        <div
                          key={request.friendshipId}
                          className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-secondary/40 p-4 sm:flex-row sm:items-center"
                        >
                          <div className="flex items-center gap-3 sm:flex-1">
                            <Avatar className="h-12 w-12">
                              {request.profile?.avatarUrl ? (
                                <AvatarImage
                                  src={request.profile.avatarUrl}
                                  alt={`${getFriendDisplayName(request.profile)} avatar`}
                                />
                              ) : (
                                <AvatarFallback>{getFriendInitials(request.profile)}</AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <p className="font-semibold">{getFriendDisplayName(request.profile)}</p>
                              <p className="text-sm text-muted-foreground">
                                @{request.profile?.username ?? "unknown"}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 sm:ml-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                void handleCancelFriendship(request.friendshipId);
                              }}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    Your friends
                    <Badge variant="secondary">{acceptedFriends.length}</Badge>
                  </CardTitle>
                  <CardDescription>See who's online and ready to jam.</CardDescription>
                </CardHeader>
                <CardContent>
                  {acceptedFriends.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Once you accept requests, your crew will appear here.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {acceptedFriends.map(friend => {
                        const status = presenceByUserId[friend.friendUserId];
                        const online = isPresenceOnline(status);
                        const badgeClass = presenceBadgeStyles(status);

                        return (
                          <div
                            key={friend.friendshipId}
                            className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-secondary/40 p-4 sm:flex-row sm:items-center"
                          >
                            <div className="flex items-center gap-3 sm:flex-1">
                              <div className="relative">
                                <Avatar className="h-12 w-12">
                                  {friend.profile?.avatarUrl ? (
                                    <AvatarImage
                                      src={friend.profile.avatarUrl}
                                      alt={`${getFriendDisplayName(friend.profile)} avatar`}
                                    />
                                  ) : (
                                    <AvatarFallback>{getFriendInitials(friend.profile)}</AvatarFallback>
                                  )}
                                </Avatar>
                                <span
                                  className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                                />
                              </div>
                              <div>
                                <p className="font-semibold">{getFriendDisplayName(friend.profile)}</p>
                                <p className="text-sm text-muted-foreground">
                                  @{friend.profile?.username ?? "unknown"}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className={badgeClass}>
                              {presenceLabel(status)}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats" className="space-y-6">
            <Alert className="border-primary/30 bg-primary/5 text-primary">
              <Sparkles className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                Weekly rehearsal cadence
                {freshWeeklyBonusAvailable && (
                  <Badge variant="secondary" className="border-primary/40 bg-primary/10 text-primary">
                    New this week
                  </Badge>
                )}
              </AlertTitle>
              <AlertDescription className="space-y-3 text-sm">
                <p>
                  {weeklyBonusAmount > 0
                    ? `You banked ${weeklyBonusSourceXp} XP from your actions and gained an extra ${weeklyBonusAmount} XP from this week's rehearsal bonus.`
                    : "Keep performing, creating, and training to build XP during the week. Every Monday at 05:15 UTC we add a rehearsal bonus based on your momentum."}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {weeklyBonusAmount > 0 && (
                    <Badge variant="secondary" className="border-primary/30 bg-primary/10 text-primary">
                      +{weeklyBonusAmount} XP bonus
                    </Badge>
                  )}
                  {weeklyBonusSourceXp > 0 && (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {weeklyBonusSourceXp} XP earned
                    </Badge>
                  )}
                  {weeklyBonusStreak > 1 && (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {weeklyBonusStreak}-week streak
                    </Badge>
                  )}
                </div>
                {formattedWeeklyBonusRecorded ? (
                  <p className="text-xs text-primary/70">
                    Last bonus processed {formattedWeeklyBonusRecorded} UTC.
                  </p>
                ) : (
                  <p className="text-xs text-primary/70">
                    Bonuses process automatically every Monday at 05:15 UTC.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => navigate("/education")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    size="sm"
                  >
                    Explore Education Hub
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Level</CardTitle>
                  <Star className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{profile.level || 1}</div>
                  <Progress value={levelProgressPercent} className="h-2 mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formattedXpTowardsNextLevel}/1000 XP to level {(profile.level ?? 1) + 1}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fame</CardTitle>
                  <Users className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">{profile.fame || 0}</div>
                  <p className="text-xs text-muted-foreground">Total followers</p>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cash</CardTitle>
                  <DollarSign className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">${(profile.cash || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Available funds</p>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Experience</CardTitle>
                  <Trophy className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{formattedLifetimeXp}</div>
                  <p className="text-xs text-muted-foreground">
                    Lifetime XP · {formattedXpBalance} spendable
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Weekly Bonus</CardTitle>
                  <Sparkles className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Latest bonus</span>
                    <span className="font-semibold text-primary">
                      {weeklyBonusAmount > 0 ? `+${weeklyBonusAmount} XP` : "Not yet awarded"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">XP earned this cycle</span>
                    <span className="font-semibold text-primary">{weeklyBonusSourceXp}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Streak</span>
                    <span className="font-semibold text-primary">
                      {weeklyBonusStreak > 0 ? `${weeklyBonusStreak} week${weeklyBonusStreak === 1 ? "" : "s"}` : "Building"}
                    </span>
                  </div>
                  {formattedWeeklyBonusRecorded ? (
                    <p className="text-xs text-muted-foreground">Processed {formattedWeeklyBonusRecorded} UTC</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Bonuses process Mondays at 05:15 UTC.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  XP Ledger
                </CardTitle>
                <CardDescription>Track how weekly bonuses and other adjustments change your XP.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentLedgerEntries.length > 0 ? recentLedgerEntries.map(entry => {
                  const metadata = (entry.metadata as Record<string, unknown> | null) ?? null;
                  const sourceXp = toNumber(metadata?.experience_gained);
                  const streak = toNumber(metadata?.streak);
                  const recordedAt = parseDate(entry.created_at);
                  const recordedLabel = recordedAt
                    ? new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      }).format(recordedAt)
                    : new Date(entry.created_at).toLocaleString();
                  const isGain = entry.xp_delta >= 0;
                  const badgeVariant = isGain ? "secondary" : "outline";
                  const badgeClasses = isGain
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-destructive/30 text-destructive";

                  return (
                    <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-primary/10 bg-secondary/20 p-3">
                      <div>
                        <p className="text-sm font-medium">{formatLedgerEvent(entry.event_type)}</p>
                        <p className="text-xs text-muted-foreground">{recordedLabel} UTC</p>
                        {entry.event_type === "weekly_bonus" && sourceXp > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Based on {sourceXp} XP earned{streak > 1 ? ` • ${streak}-week streak` : ""}
                          </p>
                        )}
                      </div>
                      <Badge variant={badgeVariant} className={badgeClasses}>
                        {entry.xp_delta >= 0 ? "+" : ""}{entry.xp_delta} XP
                      </Badge>
                    </div>
                  );
                }) : (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No XP entries yet. Play through the week to trigger your first rehearsal bonus.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Fan Insights
                </CardTitle>
                <CardDescription>Real-time metrics from your audience growth</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-primary/10 bg-secondary/40 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span>Total Fans</span>
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-primary">{totalFansValue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">All-time supporters cheering you on</p>
                  </div>
                  <div className="rounded-lg border border-primary/10 bg-secondary/40 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span>Weekly Growth</span>
                      <TrendingUp className="h-4 w-4 text-success" />
                    </div>
                    <p className={`text-2xl font-bold ${weeklyGrowthClass}`}>{weeklyGrowthDisplay}</p>
                    <p className="text-xs text-muted-foreground">New fans gained over the last seven days</p>
                  </div>
                  <div className="rounded-lg border border-primary/10 bg-secondary/40 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span>Engagement Rate</span>
                      <Heart className="h-4 w-4 text-accent" />
                    </div>
                    <p className="text-2xl font-bold text-accent">{engagementRateDisplay}%</p>
                    <p className="text-xs text-muted-foreground">Percentage of fans interacting with your content</p>
                  </div>
                </div>
                {lastUpdatedLabel && (
                  <p className="mt-4 text-xs text-muted-foreground text-right">
                    Updated {lastUpdatedLabel}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  Musical Skills
                </CardTitle>
                <CardDescription>Your musical abilities and expertise levels</CardDescription>
              </CardHeader>
              <CardContent>
                {musicalSkills.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {musicalSkills.map(({ key: skillKey, value }) => {
                      const percent = Math.min(100, (value / 1000) * 100);
                      return (
                        <div key={skillKey} className="space-y-2">
                          <span className="text-sm font-medium capitalize">{skillKey}</span>
                          <Progress
                            value={percent}
                            className="h-2"
                            aria-label={`${skillKey} skill level ${value} out of 1000`}
                          />
                          <div className="text-xs text-muted-foreground">
                            {value >= 800
                              ? "Expert"
                              : value >= 600
                                ? "Advanced"
                                : value >= 400
                                  ? "Intermediate"
                                  : "Beginner"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No musical skills meet the minimum level yet. Earn at least one point to see your progress.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Professional Attributes
                </CardTitle>
                <CardDescription>Business, creative, and technical strengths</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {attributeKeys.map(attributeKey => {
                    const value = Number(attributes?.[attributeKey] ?? 0);
                    const percent = Math.min(100, (value / 1000) * 100);
                    return (
                      <div key={attributeKey} className="space-y-2">
                        <span className="text-sm font-medium capitalize">{attributeKey}</span>
                        <Progress
                          value={percent}
                          className="h-2"
                          aria-label={`${attributeKey} attribute score ${value} out of 1000`}
                        />
                        <div className="text-xs text-muted-foreground">
                          High values unlock greater opportunities and campaign performance.
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
        ) : (
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl font-bebas tracking-wide">No Active Character Selected</CardTitle>
              <CardDescription>
                Use the manager above to create or activate a performer to unlock detailed profile controls and statistics.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;