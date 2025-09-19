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
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";
import { ATTRIBUTE_KEYS, type AttributeKey } from "@/utils/attributeProgression";

const NO_CITY_SELECTED_VALUE = "__no_city_selected__";
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

const sanitizeCityOfBirth = (value: string | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

type CityOption = {
  id: string;
  name: string | null;
  country: string | null;
};

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [stageName, setStageName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<ProfileGender>("prefer_not_to_say");
  const [cityOfBirth, setCityOfBirth] = useState<string | null>(null);

  const [cities, setCities] = useState<CityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setCitiesLoading(true);
        setCitiesError(null);

        const { data, error } = await supabase
          .from("cities")
          .select("id, name, country")
          .order("name", { ascending: true });

        if (error) throw error;

        const sanitizedCities = ((data as CityOption[] | null) ?? []).filter(
          (city): city is CityOption => typeof city.id === "string" && city.id.trim().length > 0,
        );

        setCities(sanitizedCities);
      } catch (error) {
        console.error("Failed to load cities:", error);
        setCitiesError("We couldn't load cities right now. You can update this later in your profile.");
      } finally {
        setCitiesLoading(false);
      }
    };

    void fetchCities();
  }, []);

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
        const sanitizedProfileRecord = profileRecord
          ? {
              ...profileRecord,
              city_of_birth: sanitizeCityOfBirth(profileRecord.city_of_birth),
            }
          : null;

        console.log("[CharacterCreation] Profile load result", {
          hasProfile: Boolean(sanitizedProfileRecord),
          profileId: sanitizedProfileRecord?.id ?? null,
        });
        setExistingProfile(sanitizedProfileRecord);

        if (sanitizedProfileRecord) {
          setName(sanitizedProfileRecord.username ?? "");
          setStageName(sanitizedProfileRecord.display_name ?? "");
          setBio(sanitizedProfileRecord.bio ?? "");
          setGender(sanitizedProfileRecord.gender ?? "prefer_not_to_say");
          setCityOfBirth(sanitizedProfileRecord.city_of_birth ?? null);

          if (sanitizedProfileRecord.id) {
            console.log("[CharacterCreation] Loading existing attributes", {
              profileId: sanitizedProfileRecord.id,
            });
            const { data: attributesData, error: attributesError, status: attributesStatus } = await supabase
              .from("player_attributes")
              .select("id")
              .eq("profile_id", sanitizedProfileRecord.id)
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
            console.log("[CharacterCreation] Attribute load result", {
              hasAttributes,
            });
            setHasExistingAttributes(hasAttributes);
          } else {
            console.warn("[CharacterCreation] Loaded profile without an id; skipping attribute check");
            setHasExistingAttributes(false);
          }
        } else {
          console.log("[CharacterCreation] No existing profile found; resetting form fields");
          setName("");
          setStageName("");
          setBio("");
          setGender("prefer_not_to_say");
          setCityOfBirth(null);
          setHasExistingAttributes(false);
        }
      } catch (error) {
        console.error("[CharacterCreation] Failed to load character data", error);
        setLoadError("We couldn't load your character details. You can still create a new persona.");
        setExistingProfile(null);
        setHasExistingAttributes(false);
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

    setIsSaving(true);
    setSaveError(null);

    console.log("[CharacterCreation] Starting save", {
      userId: user.id,
      existingProfileId: existingProfile?.id ?? null,
      targetProfileId,
      hasExistingAttributes,
      gender,
      cityOfBirth,
      trimmedName,
      trimmedStageName,
    });

    try {
      let savedProfile: ProfileRow | null = null;
      const sanitizedCityOfBirth = sanitizeCityOfBirth(cityOfBirth);

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
            city_of_birth: sanitizedCityOfBirth,
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
          city_of_birth: sanitizedCityOfBirth,
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

      if (!hasExistingAttributes && savedProfile.id) {
        console.log("[CharacterCreation] Creating default attributes", {
          profileId: savedProfile.id,
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
        console.log("[CharacterCreation] Default attributes created successfully");
      } else if (hasExistingAttributes) {
        console.log("[CharacterCreation] Skipping default attribute creation because attributes already exist");
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

          <div className="grid gap-6 md:grid-cols-2">
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
              <Label htmlFor="city-of-birth">City of Birth</Label>
              <Select
                value={cityOfBirth ?? NO_CITY_SELECTED_VALUE}
                onValueChange={(value) =>
                  setCityOfBirth(value === NO_CITY_SELECTED_VALUE ? null : value)
                }
                disabled={citiesLoading}
              >
                <SelectTrigger id="city-of-birth">
                  <SelectValue
                    placeholder={citiesLoading ? "Loading cities…" : "Select a city"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CITY_SELECTED_VALUE}>No listed city</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name ?? "Unnamed City"}
                      {city.country ? `, ${city.country}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {citiesError && <p className="text-sm text-destructive">{citiesError}</p>}
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
