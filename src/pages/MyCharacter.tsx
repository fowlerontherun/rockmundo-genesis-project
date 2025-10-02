import { useEffect, useMemo, useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import {
  Cake,
  CalendarDays,
  Loader2,
  MapPin,
  Mic,
  Music,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGameData, type PlayerProfile } from "@/hooks/useGameData";

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

const PROFILE_META_FIELDS: Array<{ key: keyof PlayerProfile; label: string; icon: ElementType }> = [
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
  business: "business_acumen",
  marketing: "marketing_savvy",
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
  business_acumen: "business_acumen",
  marketing_savvy: "marketing_savvy",
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
  } = useGameData();
  const { toast } = useToast();
  const [claimingDailyXp, setClaimingDailyXp] = useState(false);
  const [attributeXpInputs, setAttributeXpInputs] = useState<Record<string, number>>({});
  const [attributeSpendPending, setAttributeSpendPending] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [skillXpAmount, setSkillXpAmount] = useState<number>(DEFAULT_SKILL_SPEND);
  const [skillSpendPending, setSkillSpendPending] = useState(false);

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
          <p className="text-muted-foreground">A snapshot of your artist profile and core skills.</p>
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
                          style={{ width: `${Math.min(100, Math.max(0, displayScore))}%` }}
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
    </div>
  );
};

export default MyCharacter;
