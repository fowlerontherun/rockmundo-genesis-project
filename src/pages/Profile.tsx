import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useGameData, type PlayerProfile } from "@/hooks/useGameData";

interface ProfileFormState {
  name: string;
  stageName: string;
  bio: string;
  avatarUrl: string;
  age: string;
  gender: ProfileGender;
  hometown: string;
}

const DEFAULT_FORM_STATE: ProfileFormState = {
  name: "",
  stageName: "",
  bio: "",
  avatarUrl: "",
  age: "",
  gender: "prefer_not_to_say",
  hometown: "",
};

const sanitizeInput = (value: string) => value.replace(/\s+/g, " ");

type ProfileGender = NonNullable<PlayerProfile["gender"]>;
const GENDER_OPTIONS: Array<{ value: ProfileGender; label: string }> = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const EDITABLE_ATTRIBUTES = ["creativity", "charisma", "technical", "business", "marketing"] as const;
type EditableAttribute = (typeof EDITABLE_ATTRIBUTES)[number];
type AttributeFormState = Record<EditableAttribute, number>;

const ATTRIBUTE_MIN = 1;
const ATTRIBUTE_MAX = 10;
const DEFAULT_ATTRIBUTE_SCORE = 5;
const DEFAULT_ATTRIBUTE_FORM_STATE: AttributeFormState = EDITABLE_ATTRIBUTES.reduce(
  (accumulator, key) => {
    accumulator[key] = DEFAULT_ATTRIBUTE_SCORE;
    return accumulator;
  },
  {} as AttributeFormState,
);

const normalizeUsername = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const clampAttributeScore = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_ATTRIBUTE_SCORE;
  }

  return Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, Math.round(value)));
};

const parseAgeValue = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < 13) {
    return 13;
  }

  if (parsed > 120) {
    return 120;
  }

  return parsed;
};

const Profile = () => {
  const { profile, attributes, loading, error, updateProfile, updateAttributes, currentCity } = useGameData();
  const { toast } = useToast();

  const [formState, setFormState] = useState<ProfileFormState>(DEFAULT_FORM_STATE);
  const [attributeState, setAttributeState] = useState<AttributeFormState>(DEFAULT_ATTRIBUTE_FORM_STATE);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setFormState({
      name: profile?.username ?? "",
      stageName: profile?.display_name ?? "",
      bio: profile?.bio ?? "",
      avatarUrl: profile?.avatar_url ?? "",
      age: typeof profile?.age === "number" && Number.isFinite(profile?.age) ? String(profile?.age) : "",
      gender: profile?.gender ?? "prefer_not_to_say",
      hometown: profile?.current_location ?? "",
    });
  }, [profile?.age, profile?.avatar_url, profile?.bio, profile?.current_location, profile?.display_name, profile?.gender, profile?.username]);

  useEffect(() => {
    if (!attributes) {
      setAttributeState({ ...DEFAULT_ATTRIBUTE_FORM_STATE });
      return;
    }

    const nextState = EDITABLE_ATTRIBUTES.reduce((accumulator, key) => {
      accumulator[key] = clampAttributeScore(attributes[key] ?? DEFAULT_ATTRIBUTE_SCORE);
      return accumulator;
    }, {} as AttributeFormState);

    setAttributeState(nextState);
  }, [attributes]);

  const profileDisplayName = formState.stageName || profile?.display_name || profile?.username || "Performer";
  const avatarFallback = profileDisplayName.slice(0, 2).toUpperCase() || "RM";

  const currentCityLabel = useMemo(() => {
    if (!currentCity) {
      return null;
    }

    if (currentCity.country && currentCity.country.trim().length > 0) {
      return `${currentCity.name}, ${currentCity.country}`;
    }

    return currentCity.name ?? null;
  }, [currentCity]);

  const normalizedUsername = useMemo(() => {
    const trimmedName = sanitizeInput(formState.name).trim();
    if (trimmedName.length === 0) {
      return "";
    }

    return normalizeUsername(trimmedName);
  }, [formState.name]);

  const desiredDisplayName = useMemo(() => {
    const trimmedStageName = sanitizeInput(formState.stageName).trim();
    if (trimmedStageName.length > 0) {
      return trimmedStageName;
    }

    const trimmedName = sanitizeInput(formState.name).trim();
    if (trimmedName.length > 0) {
      return trimmedName;
    }

    return profile?.display_name ?? profile?.username ?? "Performer";
  }, [formState.name, formState.stageName, profile?.display_name, profile?.username]);

  const normalizedBio = useMemo(() => sanitizeInput(formState.bio).trim(), [formState.bio]);
  const sanitizedAvatarUrl = useMemo(() => formState.avatarUrl.trim(), [formState.avatarUrl]);
  const sanitizedHometown = useMemo(() => sanitizeInput(formState.hometown).trim(), [formState.hometown]);
  const parsedAge = useMemo(() => parseAgeValue(formState.age), [formState.age]);
  const currentProfileAge = typeof profile?.age === "number" && Number.isFinite(profile?.age) ? profile.age : null;

  const isProfilePristine = useMemo(() => {
    const currentUsername = profile?.username ?? "";
    const usernameUnchanged =
      normalizedUsername.length > 0 ? normalizedUsername === currentUsername : currentUsername.length === 0;

    const displayNameUnchanged = desiredDisplayName === (profile?.display_name ?? profile?.username ?? "Performer");
    const bioUnchanged = normalizedBio === (profile?.bio ?? "");
    const avatarUnchanged = sanitizedAvatarUrl === (profile?.avatar_url ?? "");
    const hometownUnchanged = sanitizedHometown === (profile?.current_location ?? "");
    const hasAgeInput = formState.age.trim().length > 0;
    const effectiveAge = hasAgeInput ? parsedAge ?? currentProfileAge : currentProfileAge;
    const ageUnchanged = effectiveAge === currentProfileAge;
    const genderUnchanged = (formState.gender ?? "prefer_not_to_say") === (profile?.gender ?? "prefer_not_to_say");

    return (
      usernameUnchanged &&
      displayNameUnchanged &&
      bioUnchanged &&
      avatarUnchanged &&
      hometownUnchanged &&
      ageUnchanged &&
      genderUnchanged
    );
  }, [
    normalizedUsername,
    desiredDisplayName,
    normalizedBio,
    sanitizedAvatarUrl,
    sanitizedHometown,
    parsedAge,
    currentProfileAge,
    formState.gender,
    formState.age,
    profile?.avatar_url,
    profile?.bio,
    profile?.current_location,
    profile?.display_name,
    profile?.gender,
    profile?.username,
  ]);

  const isAttributePristine = useMemo(() => {
    if (!attributes) {
      return EDITABLE_ATTRIBUTES.every((key) => attributeState[key] === DEFAULT_ATTRIBUTE_SCORE);
    }

    return EDITABLE_ATTRIBUTES.every((key) => attributeState[key] === clampAttributeScore(attributes[key] ?? DEFAULT_ATTRIBUTE_SCORE));
  }, [attributeState, attributes]);

  const isPristine = isProfilePristine && isAttributePristine;

  const handleAttributeChange = (key: EditableAttribute, value: number[]) => {
    const nextValue = clampAttributeScore(value[0] ?? DEFAULT_ATTRIBUTE_SCORE);
    setAttributeState((previous) => ({ ...previous, [key]: nextValue }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);

    const trimmedName = sanitizeInput(formState.name).trim();
    const trimmedStageName = sanitizeInput(formState.stageName).trim();

    if (trimmedName.length === 0 && trimmedStageName.length === 0) {
      setSaveError("Enter at least a name or stage name to continue.");
      return;
    }

    const trimmedBio = normalizedBio;
    const nextUsername = normalizedUsername.length > 0 ? normalizedUsername : profile?.username ?? "";
    const nextDisplayName = desiredDisplayName;
    const nextAvatarUrl = sanitizedAvatarUrl.length > 0 ? sanitizedAvatarUrl : null;
    const nextHometown = sanitizedHometown.length > 0 ? sanitizedHometown : null;
    const hasAgeInput = formState.age.trim().length > 0;
    const nextAge = hasAgeInput ? parsedAge ?? currentProfileAge : currentProfileAge;
    const nextGender = formState.gender ?? "prefer_not_to_say";

    setSaving(true);
    try {
      const profileUpdates: Parameters<typeof updateProfile>[0] = {};

      if (nextUsername !== (profile?.username ?? "")) {
        profileUpdates.username = nextUsername;
      }

      if (nextDisplayName !== (profile?.display_name ?? profile?.username ?? "Performer")) {
        profileUpdates.display_name = nextDisplayName;
      }

      if (trimmedBio !== (profile?.bio ?? "")) {
        profileUpdates.bio = trimmedBio;
      }

      if (nextAvatarUrl !== (profile?.avatar_url ?? null)) {
        profileUpdates.avatar_url = nextAvatarUrl;
      }

      if (nextHometown !== (profile?.current_location ?? null)) {
        profileUpdates.current_location = nextHometown;
      }

      if ((nextAge ?? null) !== currentProfileAge) {
        profileUpdates.age = nextAge;
      }

      if (nextGender !== (profile?.gender ?? "prefer_not_to_say")) {
        profileUpdates.gender = nextGender;
      }

      const attributePayload = EDITABLE_ATTRIBUTES.reduce((accumulator, key) => {
        const currentValue = attributes ? clampAttributeScore(attributes[key] ?? DEFAULT_ATTRIBUTE_SCORE) : DEFAULT_ATTRIBUTE_SCORE;
        const desiredValue = clampAttributeScore(attributeState[key]);
        if (desiredValue !== currentValue) {
          accumulator[key] = desiredValue;
        }
        return accumulator;
      }, {} as Parameters<typeof updateAttributes>[0]);

      const operations: Array<Promise<unknown>> = [];

      if (Object.keys(profileUpdates).length > 0) {
        operations.push(updateProfile(profileUpdates));
      }

      if (Object.keys(attributePayload).length > 0) {
        operations.push(updateAttributes(attributePayload));
      }

      if (operations.length === 0) {
        setSaveError("There are no changes to save just yet.");
        return;
      }

      await Promise.all(operations);

      toast({
        title: "Profile saved",
        description: "Your artist profile is ready to make some noise.",
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
            Introduce your performer to the world. We will start you in London with a balanced set of attributes so you
            can begin your career with confidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>We couldn&apos;t load your profile</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                  <AvatarImage src={formState.avatarUrl || profile?.avatar_url ?? undefined} alt={`${profileDisplayName} avatar`} />
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>

                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-semibold">{profileDisplayName}</h2>
                  {profile?.username && <p className="text-muted-foreground">@{profile.username}</p>}
                  <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="border-border text-foreground/80">
                      Level {profile?.level ?? 1}
                    </Badge>
                    <Badge variant="outline" className="border-border text-foreground/80">
                      {profile?.fame ?? 0} Fame
                    </Badge>
                    {currentCityLabel && (
                      <Badge variant="outline" className="border-border text-foreground/80">
                        <MapPin className="mr-1 h-3 w-3" />
                        {currentCityLabel}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    min={13}
                    max={120}
                    placeholder="18"
                    value={formState.age}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (nextValue === "" || /^\d*$/.test(nextValue)) {
                        setFormState((previous) => ({ ...previous, age: nextValue }));
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground">We use this to tailor your career opportunities.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formState.gender}
                    onValueChange={(value) =>
                      setFormState((previous) => ({ ...previous, gender: value as ProfileGender }))
                    }
                  >
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Optional demographic details help us personalize events.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hometown">Hometown</Label>
                <Input
                  id="hometown"
                  placeholder="London, United Kingdom"
                  value={formState.hometown}
                  onChange={(event) =>
                    setFormState((previous) => ({ ...previous, hometown: event.target.value }))
                  }
                />
                <p className="text-sm text-muted-foreground">Share where your story began so local fans can find you.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar image URL</Label>
                <Input
                  id="avatarUrl"
                  type="url"
                  placeholder="https://images.example/avatar.png"
                  value={formState.avatarUrl}
                  onChange={(event) => setFormState((previous) => ({ ...previous, avatarUrl: event.target.value }))}
                />
                <p className="text-sm text-muted-foreground">Paste a direct image link for a custom profile portrait.</p>
              </div>

              <div className="space-y-4 rounded-lg border border-primary/10 bg-muted/10 p-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Starter attribute focus</h3>
                  <p className="text-sm text-muted-foreground">
                    Tune the areas where your artist shines. You can grow other skills as you progress.
                  </p>
                </div>

                <div className="space-y-6">
                  {EDITABLE_ATTRIBUTES.map((attributeKey) => (
                    <div key={attributeKey} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium capitalize" htmlFor={`attribute-${attributeKey}`}>
                          {attributeKey.replace(/_/g, " ")}
                        </Label>
                        <span className="text-sm font-semibold text-primary">{attributeState[attributeKey]}</span>
                      </div>
                      <Slider
                        id={`attribute-${attributeKey}`}
                        min={ATTRIBUTE_MIN}
                        max={ATTRIBUTE_MAX}
                        step={1}
                        value={[attributeState[attributeKey]]}
                        onValueChange={(value) => handleAttributeChange(attributeKey, value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {saveError && (
                <Alert variant="destructive">
                  <AlertTitle>Profile not saved</AlertTitle>
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              )}

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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
