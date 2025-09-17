import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  SparklesIcon,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Palette,
  Gauge,
  User,
  Move3d,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AvatarPreview3D from "@/components/avatar/AvatarPreview3D";
import {
  avatarStyles,
  avatarPoses,
  avatarCameras,
  defaultAvatarSelection,
} from "@/data/avatarPresets";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";
import { useToast } from "@/components/ui/use-toast";
import { generateRandomName, generateHandleFromName } from "@/utils/nameGenerator";
import { getStoredAvatarSelection, serializeAvatarData } from "@/utils/avatar";

const backgrounds = [
  {
    id: "street",
    label: "Street Performer",
    description:
      "You honed your sound battling city noise and turning sidewalks into stages.",
  },
  {
    id: "classical",
    label: "Classically Trained",
    description:
      "Years of formal training forged your technique—now you bend the rules to your will.",
  },
  {
    id: "producer",
    label: "Bedroom Producer",
    description:
      "From humble bedroom studios, you sculpted sounds that resonate across the world.",
  },
  {
    id: "wildcard",
    label: "Wildcard", 
    description:
      "A mystery wrapped in feedback and stage fog. Your story is still being written.",
  },
];

const TOTAL_SKILL_POINTS = 13;
const MIN_SKILL_VALUE = 1;
const MAX_SKILL_VALUE = 10;

const defaultSkills = {
  guitar: 1,
  vocals: 1,
  drums: 1,
  bass: 1,
  performance: 1,
  songwriting: 1,
  composition: 1,
  creativity: 1,
  business: 1,
  marketing: 1,
  technical: 1,
};

type SkillKey = keyof typeof defaultSkills;

type ProfileRow = Tables<"profiles">;

type ProfileInsert = TablesInsert<"profiles">;
type PlayerSkillsInsert = TablesInsert<"player_skills">;

type ProfileGender = Database["public"]["Enums"]["profile_gender"];

type CityOption = {
  id: string;
  name: string | null;
  country: string | null;
};

const genderOptions: { value: ProfileGender; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const sanitizeHandle = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const CharacterCreation = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [nameSuggestion, setNameSuggestion] = useState<string>(() => generateRandomName());
  const [displayName, setDisplayName] = useState<string>(nameSuggestion);
  const [username, setUsername] = useState<string>(() => {
    const base = sanitizeHandle(nameSuggestion);
    return base || generateHandleFromName(nameSuggestion);
  });
  const [usernameEdited, setUsernameEdited] = useState<boolean>(false);
  const [bio, setBio] = useState<string>(backgrounds[0].description);
  const [selectedBackground, setSelectedBackground] = useState<string>(backgrounds[0].id);
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState<string>(
    defaultAvatarSelection.styleId,
  );
  const [selectedAvatarPose, setSelectedAvatarPose] = useState<string>(defaultAvatarSelection.poseId);
  const [selectedAvatarCamera, setSelectedAvatarCamera] = useState<string>(
    defaultAvatarSelection.cameraId,
  );
  const [skills, setSkills] = useState<Record<SkillKey, number>>(defaultSkills);
  const [existingProfile, setExistingProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gender, setGender] = useState<ProfileGender>("prefer_not_to_say");
  const [age, setAge] = useState<string>("16");
  const [cityOfBirth, setCityOfBirth] = useState<string | null>(null);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState<boolean>(false);
  const [citiesError, setCitiesError] = useState<string | null>(null);

  const selectedStyleDefinition = useMemo(
    () => avatarStyles.find((style) => style.id === selectedAvatarStyle) ?? avatarStyles[0],
    [selectedAvatarStyle],
  );

  const selectedPoseDefinition = useMemo(
    () => avatarPoses.find((pose) => pose.id === selectedAvatarPose) ?? avatarPoses[0],
    [selectedAvatarPose],
  );

  const selectedCameraDefinition = useMemo(
    () => avatarCameras.find((angle) => angle.id === selectedAvatarCamera) ?? avatarCameras[0],
    [selectedAvatarCamera],
  );

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const fetchExistingData = async () => {
      if (!user) return;

      setIsLoading(true);
      setLoadError(null);

      try {
        const [profileResponse, skillsResponse] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id, username, display_name, bio, avatar_url, level, experience, cash, fans, followers, fame, engagement_rate, gender, city_of_birth, age"
            )
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("player_skills")
            .select("id, guitar, vocals, drums, bass, performance, songwriting, composition, creativity, business, marketing, technical")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (profileResponse.error) {
          throw profileResponse.error;
        }

        if (skillsResponse.error) {
          throw skillsResponse.error;
        }

        if (profileResponse.data) {
          setExistingProfile(profileResponse.data);
          if (profileResponse.data.display_name) {
            setDisplayName(profileResponse.data.display_name);
            setNameSuggestion(profileResponse.data.display_name);
          }
          if (profileResponse.data.username) {
            setUsername(profileResponse.data.username);
            setUsernameEdited(true);
          }
          setBio(profileResponse.data.bio ?? backgrounds[0].description);
          if (profileResponse.data.gender) {
            setGender(profileResponse.data.gender as ProfileGender);
          }
          if (typeof profileResponse.data.age === "number") {
            setAge(String(profileResponse.data.age));
          }
          setCityOfBirth(profileResponse.data.city_of_birth ?? null);

          if (profileResponse.data.avatar_url) {
            const storedSelection = getStoredAvatarSelection(profileResponse.data.avatar_url);

            if (storedSelection) {
              if (avatarStyles.some((style) => style.id === storedSelection.styleId)) {
                setSelectedAvatarStyle(storedSelection.styleId);
              }

              if (avatarPoses.some((pose) => pose.id === storedSelection.poseId)) {
                setSelectedAvatarPose(storedSelection.poseId);
              }

              if (avatarCameras.some((angle) => angle.id === storedSelection.cameraId)) {
                setSelectedAvatarCamera(storedSelection.cameraId);
              }
            } else {
              const match = avatarStyles.find((style) =>
                profileResponse.data?.avatar_url?.includes(`/7.x/${style.id}/`)
              );
              if (match) {
                setSelectedAvatarStyle(match.id);
              }
            }
          }
        } else {
          setBio(backgrounds[0].description);
          setUsernameEdited(false);
        }

        if (skillsResponse.data) {
          setSkills((prev) => {
            const updated = { ...prev };
            (Object.entries(skillsResponse.data) as [string, number | null][]).forEach(
              ([key, value]) => {
                if (key in prev && typeof value === "number") {
                  updated[key as SkillKey] = value;
                }
              }
            );
            return updated;
          });
        }
      } catch (error) {
        console.error("Failed to load character data:", error);
        setLoadError("We couldn't load your character data. You can still create a new persona.");
        setExistingProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      void fetchExistingData();
    }
  }, [user]);

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

        setCities((data as CityOption[] | null) ?? []);
      } catch (error) {
        console.error("Failed to load cities:", error);
        setCitiesError("We couldn't load cities right now. You can update this later in your profile.");
      } finally {
        setCitiesLoading(false);
      }
    };

    void fetchCities();
  }, []);

  const avatarPreviewUrl = (styleId: string) => {
    const seed = encodeURIComponent(
      username || displayName || nameSuggestion || user?.id || "rockmundo"
    );
    return `https://api.dicebear.com/7.x/${styleId}/svg?seed=${seed}`;
  };

  const handleRegenerateName = () => {
    const suggestion = generateRandomName();
    setNameSuggestion(suggestion);
    if (!displayName) {
      setDisplayName(suggestion);
    }
    if (!usernameEdited) {
      setUsername(generateHandleFromName(suggestion));
      setUsernameEdited(false);
    }
  };

  const handleAcceptName = () => {
    setDisplayName(nameSuggestion);
    setUsername(generateHandleFromName(nameSuggestion));
    setUsernameEdited(false);
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!usernameEdited) {
      const sanitized = sanitizeHandle(value);
      setUsername(sanitized || generateHandleFromName(value));
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameEdited(true);
  };

  const handleSkillChange = (key: SkillKey, value: number) => {
    setSkills((prev) => {
      const currentValue = prev[key];
      const clampedValue = Math.max(MIN_SKILL_VALUE, Math.min(MAX_SKILL_VALUE, value));

      if (clampedValue === currentValue) {
        return prev;
      }

      const currentTotal = Object.values(prev).reduce((acc, val) => acc + val, 0);
      let nextValue = clampedValue;

      if (clampedValue > currentValue) {
        const availablePoints = TOTAL_SKILL_POINTS - currentTotal;

        if (availablePoints <= 0) {
          nextValue = currentValue;
        } else {
          const allowedIncrease = Math.min(clampedValue - currentValue, availablePoints);
          nextValue = currentValue + allowedIncrease;
        }
      }

      if (nextValue === currentValue) {
        return prev;
      }

      return {
        ...prev,
        [key]: nextValue,
      };
    });
  };

  const totalSkillPoints = useMemo(
    () => Object.values(skills).reduce((acc, val) => acc + val, 0),
    [skills]
  );

  const remainingSkillPoints = useMemo(
    () => Math.max(0, TOTAL_SKILL_POINTS - totalSkillPoints),
    [totalSkillPoints]
  );

  const overallocatedSkillPoints = useMemo(
    () => Math.max(0, totalSkillPoints - TOTAL_SKILL_POINTS),
    [totalSkillPoints]
  );

  const allocationComplete = totalSkillPoints === TOTAL_SKILL_POINTS;
  const allocationOver = overallocatedSkillPoints > 0;

  const handleSave = async () => {
    if (!user) return;

    const trimmedDisplayName = displayName.trim() || nameSuggestion;
    const trimmedUsername = username.trim();

    if (!trimmedDisplayName) {
      toast({
        title: "Display name required",
        description: "Choose a stage name for your artist persona.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedUsername) {
      toast({
        title: "Artist handle required",
        description: "Create a handle so other players can find you.",
        variant: "destructive",
      });
      return;
    }

    if (!allocationComplete) {
      toast({
        title: allocationOver ? "Skill allocation exceeded" : "Allocate remaining skill points",
        description: allocationOver
          ? `Reduce your skills by ${overallocatedSkillPoints} point${overallocatedSkillPoints === 1 ? "" : "s"} to hit exactly ${TOTAL_SKILL_POINTS}.`
          : `You still have ${remainingSkillPoints} point${remainingSkillPoints === 1 ? "" : "s"} to assign before saving.`,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    const selectedBackgroundDetails =
      backgrounds.find((bg) => bg.id === selectedBackground) ?? backgrounds[0];
    const finalBio = bio?.trim() || selectedBackgroundDetails.description;

    const parsedAgeValue = Number.parseInt(age, 10);
    const parsedAge = Number.isNaN(parsedAgeValue)
      ? existingProfile?.age ?? 16
      : Math.min(120, Math.max(13, parsedAgeValue));

    const activeStyle = selectedStyleDefinition ?? avatarStyles[0];
    const activePose = selectedPoseDefinition ?? avatarPoses[0];
    const activeCamera = selectedCameraDefinition ?? avatarCameras[0];

    const avatarSelection = {
      styleId: activeStyle?.id ?? defaultAvatarSelection.styleId,
      poseId: activePose?.id ?? defaultAvatarSelection.poseId,
      cameraId: activeCamera?.id ?? defaultAvatarSelection.cameraId,
    };

    const serializedAvatar = serializeAvatarData(
      avatarSelection,
      avatarPreviewUrl(avatarSelection.styleId),
    );

    const profilePayload: ProfileInsert = {
      user_id: user.id,
      username: trimmedUsername,
      display_name: trimmedDisplayName,
      bio: finalBio,
      avatar_url: serializedAvatar,
      level: existingProfile?.level ?? 1,
      experience: existingProfile?.experience ?? 0,
      cash: existingProfile?.cash ?? 500,
      fans: existingProfile?.fans ?? 0,
      followers: existingProfile?.followers ?? 0,
      fame: existingProfile?.fame ?? 0,
      engagement_rate: existingProfile?.engagement_rate ?? 0,
      gender,
      age: parsedAge,
      city_of_birth: cityOfBirth,
    };

    const skillPayload: PlayerSkillsInsert = {
      user_id: user.id,
      guitar: skills.guitar,
      vocals: skills.vocals,
      drums: skills.drums,
      bass: skills.bass,
      performance: skills.performance,
      songwriting: skills.songwriting,
      composition: skills.composition,
      creativity: skills.creativity,
      business: skills.business,
      marketing: skills.marketing,
      technical: skills.technical,
    };

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "user_id" });

      if (profileError) {
        throw profileError;
      }

      const { error: skillsError } = await supabase
        .from("player_skills")
        .upsert(skillPayload, { onConflict: "user_id" });

      if (skillsError) {
        throw skillsError;
      }

      toast({
        title: "Character ready!",
        description: "Your artist profile has been saved. Time to take the stage.",
      });

      window.dispatchEvent(new CustomEvent("profile-updated"));

      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to save character:", error);
      toast({
        title: "Could not save character",
        description: "Please review your details and try again.",
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage">
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-lg font-oswald text-foreground/80">
            Crafting your Rockmundo persona...
          </p>
        </div>
      </div>
    );
  }
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-3 text-center">
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-widest">
            Character Creation
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Design Your Stage Persona
          </h1>
          <p className="text-base text-muted-foreground">
            Shape your artist identity, pick a backstory, and tune the skills that define your playstyle.
          </p>
        </div>

        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Heads up!</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        <Card className="border-primary/20 bg-background/80 shadow-lg backdrop-blur">
          <CardHeader className="flex flex-col gap-2 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl font-semibold">Your Signature Sound</CardTitle>
              <CardDescription>
                Start with a bold alias and tailor it until it feels unmistakably yours.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={handleRegenerateName}>
                <Wand2 className="mr-2 h-4 w-4" />
                New Suggestion
              </Button>
              <Button variant="outline" onClick={handleAcceptName}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Use Suggestion
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Stage Name</label>
                  <Input
                    placeholder="Your iconic display name"
                    value={displayName}
                    onChange={(event) => handleDisplayNameChange(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Artist Handle</label>
                  <Input
                    placeholder="unique-handle-123"
                    value={username}
                    onChange={(event) => handleUsernameChange(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Handles help friends find you across the Rockmundo universe. Use letters, numbers, and dashes.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Signature Bio</label>
                  <Textarea
                    rows={4}
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Tell the world who you are, what drives your music, and the vibes you bring to every stage."
                  />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-primary/10 bg-muted/40 p-6">
                <AvatarPreview3D
                  style={selectedStyleDefinition ?? avatarStyles[0]}
                  pose={selectedPoseDefinition ?? avatarPoses[0]}
                  camera={selectedCameraDefinition ?? avatarCameras[0]}
                  className="h-44 w-44"
                />
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedStyleDefinition?.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPoseDefinition?.label} • {selectedCameraDefinition?.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This preview updates as you tweak style, pose, and camera.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-background/80 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="h-5 w-5 text-primary" />
              Choose Your Look
            </CardTitle>
            <CardDescription>
              Select the vibe that best represents your persona. You can change it later as your story evolves.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {avatarStyles.map((style) => {
                const isActive = selectedAvatarStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedAvatarStyle(style.id)}
                    className={cn(
                      "group relative flex h-full flex-col gap-3 overflow-hidden rounded-lg border bg-gradient-to-br p-4 text-left transition shadow-sm",
                      style.gradient,
                      isActive
                        ? "border-primary shadow-lg"
                        : "border-transparent opacity-90 hover:opacity-100",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-background drop-shadow-sm">
                        {style.label}
                      </h3>
                      {isActive && (
                        <span className="rounded-full bg-background/80 px-2 py-1 text-xs font-medium text-foreground">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-background/80 group-hover:text-background">
                      {style.description}
                    </p>
                    <div className="mt-auto flex items-center gap-1 rounded-md border border-background/40 bg-background/40 p-2">
                      <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-background/50 to-background/20">
                        <div
                          className="h-full w-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${style.palette.primary}, ${style.palette.accent}, ${style.palette.secondary})`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <Move3d className="h-4 w-4 text-primary" /> Pose
                </div>
                <div className="space-y-2">
                  {avatarPoses.map((poseOption) => {
                    const isActive = selectedAvatarPose === poseOption.id;
                    return (
                      <button
                        key={poseOption.id}
                        type="button"
                        onClick={() => setSelectedAvatarPose(poseOption.id)}
                        className={cn(
                          "w-full rounded-md border px-4 py-3 text-left transition",
                          isActive
                            ? "border-primary bg-primary/10 shadow"
                            : "border-border bg-background/60 hover:border-primary/60",
                        )}
                      >
                        <p className="text-sm font-semibold text-foreground">{poseOption.label}</p>
                        <p className="text-xs text-muted-foreground">{poseOption.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <Camera className="h-4 w-4 text-primary" /> Camera
                </div>
                <div className="space-y-2">
                  {avatarCameras.map((cameraOption) => {
                    const isActive = selectedAvatarCamera === cameraOption.id;
                    return (
                      <button
                        key={cameraOption.id}
                        type="button"
                        onClick={() => setSelectedAvatarCamera(cameraOption.id)}
                        className={cn(
                          "w-full rounded-md border px-4 py-3 text-left transition",
                          isActive
                            ? "border-primary bg-primary/10 shadow"
                            : "border-border bg-background/60 hover:border-primary/60",
                        )}
                      >
                        <p className="text-sm font-semibold text-foreground">{cameraOption.label}</p>
                        <p className="text-xs text-muted-foreground">{cameraOption.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-background/80 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SparklesIcon className="h-5 w-5 text-primary" />
              Backstory & Motivation
            </CardTitle>
            <CardDescription>
              Your origin sets the tone for in-game narrative moments and fan expectations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {backgrounds.map((background) => (
                <button
                  key={background.id}
                  type="button"
                  onClick={() => {
                    setSelectedBackground(background.id);
                    if (!bio || bio === backgrounds[0].description) {
                      setBio(background.description);
                    }
                  }}
                  className={cn(
                    "flex h-full flex-col gap-2 rounded-lg border p-4 text-left transition",
                    selectedBackground === background.id
                      ? "border-primary bg-primary/5 shadow"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    {background.label}
                    {selectedBackground === background.id && (
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">{background.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-background/80 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Identity Details
            </CardTitle>
            <CardDescription>
              A few personal touches to give your artist a grounded origin story.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="gender">
                  Gender
                </label>
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
                <label className="text-sm font-medium text-muted-foreground" htmlFor="age">
                  Age
                </label>
                <Input
                  id="age"
                  type="number"
                  min={13}
                  max={120}
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Default starting age is 16.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="city-of-birth">
                  City of Birth
                </label>
                <Select
                  value={cityOfBirth ?? ""}
                  onValueChange={(value) => setCityOfBirth(value || null)}
                  disabled={citiesLoading}
                >
                  <SelectTrigger id="city-of-birth">
                    <SelectValue
                      placeholder={citiesLoading ? "Loading cities..." : "Select a city"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No listed city</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name ?? "Unnamed City"}
                        {city.country ? `, ${city.country}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {citiesError && (
                  <p className="text-xs text-destructive">{citiesError}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-background/80 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-primary" />
              Skill Distribution
            </CardTitle>
            <CardDescription>
              Allocate your starting strengths. Every skill ranges from 1-10 and influences early gameplay systems.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-primary space-y-1">
              <div>
                Total Skill Points:{" "}
                <span className="font-semibold">
                  {totalSkillPoints} / {TOTAL_SKILL_POINTS}
                </span>
              </div>
              {allocationOver ? (
                <div className="text-xs text-destructive">
                  Overallocated by {overallocatedSkillPoints} point
                  {overallocatedSkillPoints === 1 ? "" : "s"}. Adjust to continue.
                </div>
              ) : (
                <div className="text-xs text-primary/80">
                  Remaining Points:{" "}
                  <span className="font-semibold">{remainingSkillPoints}</span>
                </div>
              )}
              {!allocationComplete && !allocationOver && (
                <div className="text-xs text-destructive">
                  Spend all {TOTAL_SKILL_POINTS} points to continue.
                </div>
              )}
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {(Object.keys(defaultSkills) as SkillKey[]).map((key) => (
                <div key={key} className="space-y-2 rounded-lg border border-border/70 bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{key}</span>
                    <span className="text-sm font-semibold text-primary">{skills[key]}</span>
                  </div>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[skills[key]]}
                    onValueChange={([value]) => handleSkillChange(key, value ?? skills[key])}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Confirm Character"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CharacterCreation;
