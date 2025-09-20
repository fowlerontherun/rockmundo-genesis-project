import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useGameData } from "@/hooks/useGameData";

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
  const { profile, loading, error, attributes, upsertProfileWithDefaults, currentCity } = useGameData();
  const { toast } = useToast();

  const [formState, setFormState] = useState<ProfileFormState>(DEFAULT_FORM_STATE);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setFormState({
      name: profile?.username ?? "",
      stageName: profile?.display_name ?? "",
      bio: profile?.bio ?? "",
    });
  }, [profile?.bio, profile?.display_name, profile?.username]);

  const profileDisplayName = profile?.display_name || profile?.username || "Performer";
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

  const isPristine = useMemo(() => {
    return (
      sanitizeInput(formState.name).trim() === (profile?.username ?? "").trim() &&
      sanitizeInput(formState.stageName).trim() === (profile?.display_name ?? "").trim() &&
      sanitizeInput(formState.bio).trim() === (profile?.bio ?? "").trim()
    );
  }, [formState, profile?.bio, profile?.display_name, profile?.username]);

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
        ...(attributes ? { attributes } : {}),
      });

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
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt={`${profileDisplayName} avatar`} />
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
