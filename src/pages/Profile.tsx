import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CharacterSelect from "@/components/CharacterSelect";
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
import { useFriendships, type FriendProfileSummary } from "@/hooks/useFriendships";
import { useCityOptions } from "@/hooks/useCityOptions";
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

interface ProfileFormState {
  name: string;
  stageName: string;
  bio: string;
}

const DEFAULT_FORM_STATE: ProfileFormState = {
  name: "",
  stageName: "",
  bio: "",
};

const sanitizeInput = (value: string) => value.replace(/\s+/g, " ");

const Profile = () => {
  const { profile, loading, error, upsertProfileWithDefaults } = useGameData();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    profile,
    skills,
    attributes,
    currentCity,
    updateProfile,
    freshWeeklyBonusAvailable,
    xpLedger,
    xpWallet,
    resetCharacter,
    refetch,
  } = useGameData();
  const {
    options: cityOptions,
    loading: cityOptionsLoading,
    error: cityOptionsError,
  } = useCityOptions();

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
    current_city: null,
  });
  const [friendSearchTerm, setFriendSearchTerm] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<SearchProfilesRow[]>([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState<string | null>(null);
  const [sendingFriendRequestTo, setSendingFriendRequestTo] = useState<string | null>(null);
  const [requestedFriendUserIds, setRequestedFriendUserIds] = useState<Record<string, boolean>>({});
  const friendSearchRequestId = useRef(0);
  const profileDisplayName = profile?.display_name || profile?.username || "";
  const avatarFallback = profileDisplayName.slice(0, 2).toUpperCase() || "RM";

  const cityLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of cityOptions) {
      map.set(option.id, option.label);
    }
    return map;
  }, [cityOptions]);

  const birthCityLabel = useMemo(() => {
    if (!profile?.city_of_birth) {
      return null;
    }
    return cityLabelById.get(profile.city_of_birth) ?? null;
  }, [cityLabelById, profile?.city_of_birth]);

  const currentCityLabel = useMemo(() => {
    if (currentCity?.name) {
      return currentCity.country && currentCity.country.trim().length > 0
        ? `${currentCity.name}, ${currentCity.country}`
        : currentCity.name;
    }

    const cityId = profile?.current_city ?? profile?.current_city_id ?? null;
    if (!cityId) {
      return null;
    }

    return cityLabelById.get(cityId) ?? null;
  }, [cityLabelById, currentCity, profile?.current_city, profile?.current_city_id]);

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
    setFormState({
      name: profile?.username ?? "",
      stageName: profile?.display_name ?? "",
      bio: profile?.bio ?? "",
    });
  }, [profile]);

  const isPristine = useMemo(() => {
    return (
      sanitizeInput(formState.name).trim() === (profile?.username ?? "").trim() &&
      sanitizeInput(formState.stageName).trim() === (profile?.display_name ?? "").trim() &&
      sanitizeInput(formState.bio).trim() === (profile?.bio ?? "").trim()
    );
  }, [formState, profile]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);

    const trimmedName = sanitizeInput(formState.name).trim();
    const trimmedStageName = sanitizeInput(formState.stageName).trim();
    const trimmedBio = sanitizeInput(formState.bio).trim();

    if (trimmedName.length === 0 && trimmedStageName.length === 0) {
      setSaveError("Enter at least a name or stage name to continue.");
      return;
    }

    setSaving(true);
    try {
      await upsertProfileWithDefaults({
        name: trimmedName,
        stageName: trimmedStageName,
        bio: trimmedBio,
      });

      toast({
        title: "Profile saved",
        description: "Your artist profile is now based in London with balanced attributes.",
      });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to save profile";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-8">
      <Card className="border-primary/20 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bebas tracking-wide">
            <Sparkles className="h-5 w-5" />
            Artist Profile
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Introduce your performer. We will start you in <span className="font-semibold text-primary">London</span> and
            set all attributes to <span className="font-semibold text-primary">5</span> so you can begin your career with a
            balanced foundation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>We couldn&apos;t load your profile</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

            <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                        <AvatarImage
                          src={profile.avatar_url ?? undefined}
                          alt={profileDisplayName ? `${profileDisplayName} avatar` : "Player avatar"}
                        />
                        <AvatarFallback>{avatarFallback}</AvatarFallback>
                      </Avatar>
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
                    </div>
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
                        {birthCityLabel && (
                          <Badge variant="outline" className="border-border text-foreground/80">
                            Born in {birthCityLabel}
                          </Badge>
                        )}
                        {currentCityLabel && (
                          <Badge variant="outline" className="border-border text-foreground/80">
                            Based in {currentCityLabel}
                          </Badge>
                        )}
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


          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Jamie Rivera"
                value={formState.name}
                onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))}
              />
              <p className="text-sm text-muted-foreground">
                Used to generate your handle. We&apos;ll keep things unique even if others pick the same name.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stageName">Stage name</Label>
              <Input
                id="stageName"
                placeholder="Neon Meridian"
                value={formState.stageName}
                onChange={(event) => setFormState((previous) => ({ ...previous, stageName: event.target.value }))}
              />
              <p className="text-sm text-muted-foreground">Displayed across the world when fans discover your music.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Share a short origin story, inspirations, or vibe for your artist."
                value={formState.bio}
                onChange={(event) => setFormState((previous) => ({ ...previous, bio: event.target.value }))}
                rows={5}
              />
            </div>

            <div className="rounded-lg border border-muted-foreground/20 bg-muted/40 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Launch city & attributes
              </div>
              <p className="mt-2">
                When you save, we&apos;ll automatically station you in London and balance every tracked attribute to 5. You can
                grow from there by performing, practicing, and managing your career.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="submit" disabled={saving || isPristine}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </span>
                ) : (
                  "Save profile"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
