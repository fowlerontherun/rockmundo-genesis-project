import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useCityOptions } from "@/hooks/useCityOptions";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";
import { ATTRIBUTE_KEYS, type AttributeKey } from "@/utils/attributeProgression";

const DEFAULT_ATTRIBUTE_VALUE = 5;

const DEFAULT_ATTRIBUTE_DISTRIBUTION: Record<AttributeKey, number> = ATTRIBUTE_KEYS.reduce(
  (accumulator, key) => {
    accumulator[key] = DEFAULT_ATTRIBUTE_VALUE;
    return accumulator;
  },
  {} as Record<AttributeKey, number>,
);

type ProfileRow = Tables<"profiles">;
type PlayerAttributesInsert = TablesInsert<"player_attributes">;
type ProfileGender = Database["public"]["Enums"]["profile_gender"];

type CharacterCreationLocationState = {
  fromProfile?: boolean;
  profileId?: string | null;
};

const genderOptions: Array<{ value: ProfileGender; label: string }> = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const CharacterCreation = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { refreshCharacters, setActiveCharacter, selectedCharacterId, profile: activeProfile } = useGameData();
  const {
    options: cityOptions,
    loading: cityOptionsLoading,
    error: cityOptionsError,
  } = useCityOptions();

  const locationState = location.state as CharacterCreationLocationState | null;
  const fromProfileFlow = Boolean(locationState?.fromProfile);
  const locationProfileId =
    typeof locationState?.profileId === "string" && locationState.profileId.length > 0
      ? locationState.profileId
      : null;
  const activeProfileId = activeProfile?.id ?? null;
  const targetProfileId = useMemo(() => {
    return locationProfileId ?? selectedCharacterId ?? activeProfileId ?? null;
  }, [locationProfileId, selectedCharacterId, activeProfileId]);

  const [existingProfile, setExistingProfile] = useState<ProfileRow | null>(null);
  const [hasExistingAttributes, setHasExistingAttributes] = useState(false);
  const [needsAttributeBackfill, setNeedsAttributeBackfill] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [stageName, setStageName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<ProfileGender>("prefer_not_to_say");
  const [age, setAge] = useState("16");
  const [cityOfBirthId, setCityOfBirthId] = useState("");
  const [currentCityId, setCurrentCityId] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const fetchExistingData = async () => {
      console.log("[CharacterCreation] Starting fetchExistingData", {
        hasUser: Boolean(user),
        userId: user?.id ?? null,
        targetProfileId,
      });

      if (!user) {
        console.log("[CharacterCreation] Aborting fetchExistingData because no user is present");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      const scopedProfileId = targetProfileId;
      const shouldUseProfileScope = Boolean(scopedProfileId);

      console.log("[CharacterCreation] Loading profile data", {
        scopedProfileId,
        shouldUseProfileScope,
      });

      try {
        const profileQuery = shouldUseProfileScope
          ? supabase.from("profiles").select("*").eq("id", scopedProfileId!)
          : supabase.from("profiles").select("*").eq("user_id", user.id);

        const { data: profileData, error: profileError, status: profileStatus } = await profileQuery.maybeSingle();

        if (profileError && profileStatus !== 406) {
          console.error("[CharacterCreation] Error retrieving profile", {
            profileError,
            profileStatus,
          });
          throw profileError;
        }

        if (profileStatus === 406) {
          console.warn("[CharacterCreation] Multiple profile rows detected for user scope; ignoring results", {
            profileStatus,
          });
        }

        const profileRecord = (profileData as ProfileRow | null) ?? null;
        console.log("[CharacterCreation] Profile load result", {
          hasProfile: Boolean(profileRecord),
          profileId: profileRecord?.id ?? null,
        });
        setExistingProfile(profileRecord);

        if (profileRecord) {
          setName(profileRecord.username ?? "");
          setStageName(profileRecord.display_name ?? "");
          setBio(profileRecord.bio ?? "");
          setGender(profileRecord.gender ?? "prefer_not_to_say");
          setAge(
            typeof profileRecord.age === "number" && Number.isFinite(profileRecord.age)
              ? String(profileRecord.age)
              : "16",
          );
          setCityOfBirthId(profileRecord.city_of_birth ?? "");
          const activeCityId = profileRecord.current_city ?? profileRecord.current_city_id ?? null;
          setCurrentCityId(activeCityId ?? "");

          if (profileRecord.id) {
            console.log("[CharacterCreation] Loading existing attributes", {
              profileId: profileRecord.id,
            });
            const attributeColumns = ["id", ...ATTRIBUTE_KEYS] as const;
            const { data: attributesData, error: attributesError, status: attributesStatus } = await supabase
              .from("player_attributes")
              .select(attributeColumns.join(", "))
              .eq("profile_id", profileRecord.id)
              .maybeSingle();

            if (attributesError && attributesStatus !== 406) {
              console.error("[CharacterCreation] Error retrieving attributes", {
                attributesError,
                attributesStatus,
              });
              throw attributesError;
            }

            if (attributesStatus === 406) {
              console.warn("[CharacterCreation] Multiple attribute rows detected; using first result");
            }

            const hasAttributes = Boolean(attributesData);
            const attributeSnapshot = attributesData as Tables<"player_attributes"> | null;
            const isZeroDistribution = ATTRIBUTE_KEYS.every((key) => {
              const value = attributeSnapshot?.[key];
              return typeof value !== "number" || value <= 0;
            });
            console.log("[CharacterCreation] Attribute load result", {
              hasAttributes,
              isZeroDistribution,
            });
            setHasExistingAttributes(hasAttributes);
            setNeedsAttributeBackfill(hasAttributes && isZeroDistribution);
          } else {
            console.warn("[CharacterCreation] Loaded profile without an id; skipping attribute check");
            setHasExistingAttributes(false);
            setNeedsAttributeBackfill(false);
          }
        } else {
          console.log("[CharacterCreation] No existing profile found; resetting form fields");
          setName("");
          setStageName("");
          setBio("");
          setGender("prefer_not_to_say");
          setAge("16");
          setCityOfBirthId("");
          setCurrentCityId("");
          setHasExistingAttributes(false);
          setNeedsAttributeBackfill(false);
        }
      } catch (error) {
        console.error("[CharacterCreation] Failed to load character data", error);
        setLoadError("We couldn't load your character details. You can still create a new persona.");
        setExistingProfile(null);
        setHasExistingAttributes(false);
        setNeedsAttributeBackfill(false);
      } finally {
        setIsLoading(false);
        console.log("[CharacterCreation] Finished fetchExistingData");
      }
    };

    void fetchExistingData();
  }, [user, targetProfileId]);

  useEffect(() => {
    if (!loading && !isLoading && existingProfile && !fromProfileFlow) {
      navigate("/profile", { replace: true });
    }
  }, [loading, isLoading, existingProfile, fromProfileFlow, navigate]);

  const handleSave = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const trimmedName = name.trim();
    const trimmedStageName = stageName.trim();
    const trimmedBio = bio.trim();

    if (!trimmedName) {
      console.warn("[CharacterCreation] Preventing save due to missing name");
      toast({
        title: "Name required",
        description: "Enter a unique name for your artist persona.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedStageName) {
      console.warn("[CharacterCreation] Preventing save due to missing stage name");
      toast({
        title: "Stage name required",
        description: "Enter the stage name you want other players to see.",
        variant: "destructive",
      });
      return;
    }

    const parsedAge = Number.parseInt(age, 10);
    if (!Number.isFinite(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      console.warn("[CharacterCreation] Preventing save due to invalid age", { age });
      toast({
        title: "Invalid age",
        description: "Age must be between 13 and 120 for your artist persona.",
        variant: "destructive",
      });
      return;
    }

    const normalizedBirthCityId = cityOfBirthId.trim().length > 0 ? cityOfBirthId : null;
    const normalizedCurrentCityId = currentCityId.trim().length > 0 ? currentCityId : null;

    setIsSaving(true);
    setSaveError(null);

    console.log("[CharacterCreation] Starting save", {
      userId: user.id,
      existingProfileId: existingProfile?.id ?? null,
      targetProfileId,
      hasExistingAttributes,
      needsAttributeBackfill,
      gender,
      age: parsedAge,
      trimmedName,
      trimmedStageName,
      normalizedBirthCityId,
      normalizedCurrentCityId,
    });

    try {
      let savedProfile: ProfileRow | null = null;

      if (existingProfile) {
        console.log("[CharacterCreation] Updating existing profile", {
          profileId: existingProfile.id,
        });
        const { data, error } = await supabase
          .from("profiles")
          .update({
            username: trimmedName,
            display_name: trimmedStageName,
            bio: trimmedBio.length > 0 ? trimmedBio : null,
            gender,
            age: parsedAge,
            city_of_birth: normalizedBirthCityId,
            current_city: normalizedCurrentCityId,
            current_city_id: normalizedCurrentCityId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingProfile.id)
          .select()
          .single();

        if (error) {
          console.error("[CharacterCreation] Error updating profile", error);
          throw error;
        }

        console.log("[CharacterCreation] Updated profile response", data);
        savedProfile = (data as ProfileRow | null) ?? null;
      } else {
        console.log("[CharacterCreation] Creating new profile", {
          userId: user.id,
        });
        const insertPayload: TablesInsert<"profiles"> = {
          user_id: user.id,
          username: trimmedName,
          display_name: trimmedStageName,
          bio: trimmedBio.length > 0 ? trimmedBio : null,
          gender,
          age: parsedAge,
          city_of_birth: normalizedBirthCityId,
          current_city: normalizedCurrentCityId,
          current_city_id: normalizedCurrentCityId,
        };

        const { data, error } = await supabase
          .from("profiles")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          console.error("[CharacterCreation] Error inserting profile", error);
          throw error;
        }

        console.log("[CharacterCreation] Inserted profile response", data);
        savedProfile = (data as ProfileRow | null) ?? null;
      }

      if (!savedProfile) {
        console.error("[CharacterCreation] No profile returned after save");
        throw new Error("The profile could not be saved.");
      }

      setExistingProfile(savedProfile);
      setAge(
        typeof savedProfile.age === "number" && Number.isFinite(savedProfile.age)
          ? String(savedProfile.age)
          : String(parsedAge),
      );
      setCityOfBirthId(savedProfile.city_of_birth ?? "");
      const savedCurrentCityId = savedProfile.current_city ?? savedProfile.current_city_id ?? normalizedCurrentCityId;
      setCurrentCityId(savedCurrentCityId ?? "");

      const shouldEnsureAttributes = Boolean(savedProfile.id) && (!hasExistingAttributes || needsAttributeBackfill);

      if (shouldEnsureAttributes && savedProfile.id) {
        console.log("[CharacterCreation] Ensuring default attributes", {
          profileId: savedProfile.id,
          hadExistingAttributes: hasExistingAttributes,
          needsAttributeBackfill,
        });
        const attributePayload: PlayerAttributesInsert = {
          user_id: user.id,
          profile_id: savedProfile.id,
          ...DEFAULT_ATTRIBUTE_DISTRIBUTION,
        };

        const { error: attributesError } = await supabase
          .from("player_attributes")
          .upsert(attributePayload, { onConflict: "profile_id" })
          .select()
          .maybeSingle();

        if (attributesError) {
          console.error("[CharacterCreation] Error upserting attributes", attributesError);
          throw attributesError;
        }

        setHasExistingAttributes(true);
        setNeedsAttributeBackfill(false);
        console.log("[CharacterCreation] Default attributes ensured successfully");
      } else if (hasExistingAttributes) {
        console.log("[CharacterCreation] Skipping default attribute creation because attributes already exist", {
          needsAttributeBackfill,
        });
      }

      console.log("[CharacterCreation] Refreshing characters after save");
      await refreshCharacters();
      console.log("[CharacterCreation] Characters refreshed successfully");
      console.log("[CharacterCreation] Setting active character", {
        profileId: savedProfile.id,
      });
      setActiveCharacter(savedProfile.id);
      console.log("[CharacterCreation] Active character updated");

      toast({
        title: "Character saved",
        description: "Your artist profile has been updated.",
      });

      window.dispatchEvent(new CustomEvent("profile-updated"));
      console.log("[CharacterCreation] Emitted profile-updated event and navigating to dashboard");
      navigate("/dashboard");
    } catch (error) {
      console.error("[CharacterCreation] Failed to save character", error);
      const message =
        typeof error === "string"
          ? error
          : error instanceof Error
          ? error.message
          : "An unknown error occurred while saving.";
      setSaveError(message);
      toast({
        title: "Could not save character",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/dashboard");
  };

  if (loading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading character creator…</CardTitle>
            <CardDescription>Preparing your artist profile.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create Your Character</CardTitle>
          <CardDescription>
            Provide the essentials for your artist persona. Attributes will start at 5/1000 and can grow through play.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadError && (
            <Alert variant="destructive">
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {saveError && (
            <Alert variant="destructive">
              <AlertTitle>Save failed</AlertTitle>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your artist name"
            />
            <p className="text-sm text-muted-foreground">
              This is your unique handle within Rockmundo. It must be distinct from other players.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage-name">Stage Name</Label>
            <Input
              id="stage-name"
              value={stageName}
              onChange={(event) => setStageName(event.target.value)}
              placeholder="What do fans call you on stage?"
            />
            <p className="text-sm text-muted-foreground">Displayed publicly across leaderboards and venues.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Share a short backstory for your artist persona."
              rows={4}
            />
            <p className="text-sm text-muted-foreground">Let the world know who you are and what drives your sound.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={(value) => setGender(value as ProfileGender)}>
                <SelectTrigger id="gender">
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
                value={age}
                onChange={(event) => setAge(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth-city">City of Birth</Label>
              <Select
                value={cityOfBirthId}
                onValueChange={(value) => setCityOfBirthId(value)}
                disabled={cityOptionsLoading}
              >
                <SelectTrigger id="birth-city">
                  <SelectValue
                    placeholder={cityOptionsLoading ? "Loading cities..." : "Select a birth city"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unspecified</SelectItem>
                  {cityOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cityOptionsError && <p className="text-xs text-destructive">{cityOptionsError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="current-city">Current City</Label>
              <Select
                value={currentCityId}
                onValueChange={(value) => setCurrentCityId(value)}
                disabled={cityOptionsLoading}
              >
                <SelectTrigger id="current-city">
                  <SelectValue
                    placeholder={cityOptionsLoading ? "Loading cities..." : "Select a current city"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unspecified</SelectItem>
                  {cityOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Alert>
            <AlertTitle>Attribute defaults</AlertTitle>
            <AlertDescription>
              All performance attributes start at 5 out of 1000. Grow them by practicing, performing, and progressing in the
              world.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-primary">
              {isSaving ? "Saving…" : "Save Character"}
            </Button>
            <Button onClick={handleCancel} variant="outline" disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CharacterCreation;
