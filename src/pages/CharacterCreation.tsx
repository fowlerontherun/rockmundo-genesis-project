import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { useCityOptions } from "@/hooks/useCityOptions";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

const DEFAULT_ATTRIBUTE_VALUE = 5;
const genderEnumValues = ["female", "male", "non_binary", "other", "prefer_not_to_say"] as const;

const ATTRIBUTE_FORM_KEYS = [
  "charisma",
  "looks",
  "mental_focus",
  "musicality",
  "musical_ability",
  "vocal_talent",
  "rhythm_sense",
  "physical_endurance",
  "stage_presence",
  "crowd_engagement",
  "social_reach",
  "creative_insight",
  "technical_mastery",
  "business_acumen",
  "marketing_savvy",
] as const;

const ATTRIBUTE_SECTIONS: Array<{
  title: string;
  description: string;
  keys: typeof ATTRIBUTE_FORM_KEYS[number][];
}> = [
  {
    title: "Stage Presence & Spotlight",
    description: "Define how magnetic your artist feels on stage and across social channels.",
    keys: ["charisma", "stage_presence", "crowd_engagement", "looks", "social_reach"],
  },
  {
    title: "Musicianship & Focus",
    description: "Tune the core musical instincts that drive songwriting, rehearsal, and performance.",
    keys: [
      "musicality",
      "musical_ability",
      "vocal_talent",
      "rhythm_sense",
      "creative_insight",
      "technical_mastery",
      "mental_focus",
    ],
  },
  {
    title: "Business Drive & Endurance",
    description: "Set the hustle factors that impact touring stamina and commercial strategy.",
    keys: ["business_acumen", "marketing_savvy", "physical_endurance"],
  },
];

type AttributeFormKey = (typeof ATTRIBUTE_FORM_KEYS)[number];
type ProfileRow = Tables<"profiles">;
type PlayerAttributesRow = Tables<"player_attributes">;
type PlayerAttributesInsert = TablesInsert<"player_attributes">;
type ProfileInsert = TablesInsert<"profiles">;
type ProfileUpdate = TablesUpdate<"profiles">;
type ProfileGender = Database["public"]["Enums"]["profile_gender"];

const attributeSchema = z.object(
  ATTRIBUTE_FORM_KEYS.reduce(
    (accumulator, key) => ({
      ...accumulator,
      [key]: z
        .coerce
        .number({ invalid_type_error: "Enter a value" })
        .min(0, "Attributes cannot be negative")
        .max(1000, "Attributes cap at 1000"),
    }),
    {} as Record<AttributeFormKey, z.ZodTypeAny>,
  ),
);

const optionalUuidSchema = z.union([z.string().uuid(), z.literal("")]);
const UNSPECIFIED_SELECT_VALUE = "__unspecified__";

const characterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(60, "Name must be under 60 characters"),
  display_name: z
    .string()
    .trim()
    .min(1, "Stage name is required")
    .max(80, "Stage name must be under 80 characters"),
  bio: z
    .string()
    .trim()
    .max(500, "Bio can be up to 500 characters")
    .optional()
    .transform(value => value ?? ""),
  gender: z.enum(genderEnumValues),
  age: z.coerce.number().int().min(13, "Must be at least 13").max(120, "Must be 120 or younger"),
  city_of_birth: optionalUuidSchema,
  current_city_id: optionalUuidSchema,
  current_location: z
    .string()
    .trim()
    .min(2, "Enter a location or leave as Unknown")
    .max(120, "Location must be under 120 characters"),
  health: z.coerce.number().int().min(0, "Health cannot be negative").max(100, "Health tops out at 100"),
  attributes: attributeSchema,
});

type CharacterFormValues = z.infer<typeof characterSchema>;

type CharacterCreationLocationState = {
  fromProfile?: boolean;
  profileId?: string | null;
};

const formatAttributeLabel = (attributeKey: AttributeFormKey) =>
  attributeKey
    .toString()
    .split("_")
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const buildDefaultAttributes = () =>
  ATTRIBUTE_FORM_KEYS.reduce(
    (accumulator, key) => {
      accumulator[key] = DEFAULT_ATTRIBUTE_VALUE;
      return accumulator;
    },
    {} as Record<AttributeFormKey, number>,
  );

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
    typeof locationState?.profileId === "string" && locationState.profileId.length > 0 ? locationState.profileId : null;
  const activeProfileId = activeProfile?.id ?? null;
  const targetProfileId = useMemo(
    () => locationProfileId ?? selectedCharacterId ?? activeProfileId ?? null,
    [locationProfileId, selectedCharacterId, activeProfileId],
  );

  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      username: "",
      display_name: "",
      bio: "",
      gender: "prefer_not_to_say",
      age: 16,
      city_of_birth: "",
      current_city_id: "",
      current_location: "Unknown",
      health: 100,
      attributes: buildDefaultAttributes(),
    },
  });

  const [existingProfile, setExistingProfile] = useState<ProfileRow | null>(null);
  const [existingAttributes, setExistingAttributes] = useState<PlayerAttributesRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const watchedAttributes = form.watch("attributes");
  const totalAttributeScore = useMemo(
    () =>
      Object.values(watchedAttributes ?? {}).reduce((sum, value) => {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? sum + numericValue : sum;
      }, 0),
    [watchedAttributes],
  );

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchExistingData = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const shouldUseProfileScope = Boolean(targetProfileId);
        const profileQuery = shouldUseProfileScope
          ? supabase.from("profiles").select("*").eq("id", targetProfileId!)
          : supabase.from("profiles").select("*").eq("user_id", user.id);

        const { data: profileData, error: profileError } = await profileQuery.maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const profileRecord = (profileData as ProfileRow | null) ?? null;
        setExistingProfile(profileRecord);

        const defaultAttributes = buildDefaultAttributes();

        if (profileRecord?.id) {
          const attributeColumns = ["id", "profile_id", "user_id", ...ATTRIBUTE_FORM_KEYS] as const;
          const { data: attributesData, error: attributesError } = await supabase
            .from("player_attributes")
            .select(attributeColumns.join(", "))
            .eq("profile_id", profileRecord.id)
            .maybeSingle();

          if (attributesError) {
            throw attributesError;
          }

          const attributeRecord = (attributesData as PlayerAttributesRow | null) ?? null;
          setExistingAttributes(attributeRecord);

          if (attributeRecord) {
            for (const key of ATTRIBUTE_FORM_KEYS) {
              const rawValue = attributeRecord[key];
              if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
                defaultAttributes[key] = rawValue;
              }
            }
          }

          const resolvedCurrentCity = profileRecord.current_city_id ?? profileRecord.current_city ?? "";
          form.reset({
            username: profileRecord.username ?? "",
            display_name: profileRecord.display_name ?? "",
            bio: profileRecord.bio ?? "",
            gender: (profileRecord.gender ?? "prefer_not_to_say") as ProfileGender,
            age: typeof profileRecord.age === "number" && Number.isFinite(profileRecord.age) ? profileRecord.age : 16,
            city_of_birth: profileRecord.city_of_birth ?? "",
            current_city_id: resolvedCurrentCity ?? "",
            current_location: profileRecord.current_location ?? "Unknown",
            health: typeof profileRecord.health === "number" && Number.isFinite(profileRecord.health)
              ? profileRecord.health
              : 100,
            attributes: defaultAttributes,
          });
        } else {
          setExistingAttributes(null);
          form.reset({
            username: "",
            display_name: "",
            bio: "",
            gender: "prefer_not_to_say",
            age: 16,
            city_of_birth: "",
            current_city_id: "",
            current_location: "Unknown",
            health: 100,
            attributes: defaultAttributes,
          });
        }
      } catch (error) {
        console.error("[CharacterCreation] Failed to load character data", error);
        setExistingProfile(null);
        setExistingAttributes(null);
        setLoadError("We couldn't load your character details. You can still create a new persona.");
        form.reset({
          username: "",
          display_name: "",
          bio: "",
          gender: "prefer_not_to_say",
          age: 16,
          city_of_birth: "",
          current_city_id: "",
          current_location: "Unknown",
          health: 100,
          attributes: buildDefaultAttributes(),
        });
      } finally {
        setIsLoading(false);
      }
    };

    void fetchExistingData();
  }, [form, targetProfileId, user]);

  useEffect(() => {
    if (!loading && !isLoading && existingProfile && !fromProfileFlow) {
      navigate("/profile", { replace: true });
    }
  }, [loading, isLoading, existingProfile, fromProfileFlow, navigate]);

  const onSubmit = async (values: CharacterFormValues) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const trimmedName = values.username.trim();
    const trimmedStageName = values.display_name.trim();
    const trimmedBio = values.bio?.trim() ?? "";
    const normalizedBio = trimmedBio.length > 0 ? trimmedBio : null;
    const normalizedBirthCityId = values.city_of_birth.length > 0 ? values.city_of_birth : null;
    const normalizedCurrentCityId = values.current_city_id.length > 0 ? values.current_city_id : null;
    const normalizedLocation = values.current_location.trim().length > 0 ? values.current_location.trim() : "Unknown";

    try {
      let savedProfile: ProfileRow | null = null;

      if (existingProfile) {
        const updatePayload: ProfileUpdate = {
          username: trimmedName,
          display_name: trimmedStageName,
          bio: normalizedBio,
          gender: values.gender,
          age: values.age,
          city_of_birth: normalizedBirthCityId,
          current_city: normalizedCurrentCityId,
          current_city_id: normalizedCurrentCityId,
          current_location: normalizedLocation,
          health: values.health,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("profiles")
          .update(updatePayload)
          .eq("id", existingProfile.id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        savedProfile = (data as ProfileRow | null) ?? null;
      } else {
        const insertPayload: ProfileInsert = {
          user_id: user.id,
          username: trimmedName,
          display_name: trimmedStageName,
          bio: normalizedBio,
          gender: values.gender,
          age: values.age,
          city_of_birth: normalizedBirthCityId,
          current_city: normalizedCurrentCityId,
          current_city_id: normalizedCurrentCityId,
          current_location: normalizedLocation,
          health: values.health,
        };

        const { data, error } = await supabase
          .from("profiles")
          .insert(insertPayload)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        savedProfile = (data as ProfileRow | null) ?? null;
      }

      if (!savedProfile) {
        throw new Error("The profile could not be saved.");
      }

      setExistingProfile(savedProfile);

      const attributePayload: PlayerAttributesInsert = {
        user_id: user.id,
        profile_id: savedProfile.id,
      };

      for (const key of ATTRIBUTE_FORM_KEYS) {
        attributePayload[key] = values.attributes[key];
      }

      const { data: attributesData, error: attributesError } = await supabase
        .from("player_attributes")
        .upsert(attributePayload, { onConflict: "profile_id" })
        .select("*")
        .maybeSingle();

      if (attributesError) {
        throw attributesError;
      }

      setExistingAttributes((attributesData as PlayerAttributesRow | null) ?? null);

      await refreshCharacters();
      await setActiveCharacter(savedProfile.id);

      toast({
        title: "Character saved",
        description: "Your artist profile has been updated.",
      });

      window.dispatchEvent(new CustomEvent("profile-updated"));
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
            Provide the essentials for your artist persona. These details map directly to your in-game profile and starting
            attributes.
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profile Handle</FormLabel>
                      <FormControl>
                        <Input placeholder="Unique artist handle" {...field} disabled={isSaving} />
                      </FormControl>
                      <FormDescription>This must be unique and is used for identification in-game.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage Name</FormLabel>
                      <FormControl>
                        <Input placeholder="What do fans call you on stage?" {...field} disabled={isSaving} />
                      </FormControl>
                      <FormDescription>Displayed publicly across leaderboards and venues.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Share a short backstory for your artist persona."
                        rows={4}
                        {...field}
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormDescription>Let the world know who you are and what drives your sound.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {genderEnumValues.map(option => (
                            <SelectItem key={option} value={option}>
                              {option
                                .split("_")
                                .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
                                .join(" ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age</FormLabel>
                      <FormControl>
                        <Input type="number" min={13} max={120} {...field} disabled={isSaving} />
                      </FormControl>
                      <FormDescription>Age must be between 13 and 120.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City of Birth</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(
                            value === UNSPECIFIED_SELECT_VALUE ? "" : value,
                          )
                        }
                        value={
                          field.value && field.value.length > 0
                            ? field.value
                            : UNSPECIFIED_SELECT_VALUE
                        }
                        disabled={cityOptionsLoading || isSaving}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={cityOptionsLoading ? "Loading cities..." : "Select a birth city"}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UNSPECIFIED_SELECT_VALUE}>
                            Unspecified
                          </SelectItem>
                          {cityOptions.map(option => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cityOptionsError && <p className="text-xs text-destructive">{cityOptionsError}</p>}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="current_city_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current City</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(
                            value === UNSPECIFIED_SELECT_VALUE ? "" : value,
                          )
                        }
                        value={
                          field.value && field.value.length > 0
                            ? field.value
                            : UNSPECIFIED_SELECT_VALUE
                        }
                        disabled={cityOptionsLoading || isSaving}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={cityOptionsLoading ? "Loading cities..." : "Select a current city"}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UNSPECIFIED_SELECT_VALUE}>
                            Unspecified
                          </SelectItem>
                          {cityOptions.map(option => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="current_location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. London Rehearsal Studio" {...field} disabled={isSaving} />
                      </FormControl>
                      <FormDescription>Displayed on travel timelines and event invites.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="health"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Health</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={100} {...field} disabled={isSaving} />
                      </FormControl>
                      <FormDescription>Impacts touring stamina and wellness activities.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground">
                    Allocate your starting attributes. Each score mirrors the values shown on the profile attributes tab. Total
                    starting score: <span className="font-semibold text-primary">{totalAttributeScore}</span>
                  </p>
                </div>

                {ATTRIBUTE_SECTIONS.map(section => (
                  <div key={section.title} className="space-y-4 rounded-lg border border-border bg-card/50 p-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {section.keys.map(attributeKey => (
                        <FormField
                          key={attributeKey}
                          control={form.control}
                          name={`attributes.${attributeKey}` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{formatAttributeLabel(attributeKey)}</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} max={1000} step={1} {...field} disabled={isSaving} />
                              </FormControl>
                              <FormDescription>Higher values unlock more opportunities in early gameplay.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit" disabled={isSaving} className="bg-gradient-primary">
                  {isSaving ? "Saving…" : "Save Character"}
                </Button>
                <Button onClick={handleCancel} type="button" variant="outline" disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CharacterCreation;
