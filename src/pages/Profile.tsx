import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const { profile, loading, error, upsertProfileWithDefaults } = useGameData();
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

          {saveError && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Unable to save profile</AlertTitle>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

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
