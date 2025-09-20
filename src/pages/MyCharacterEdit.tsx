import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const SKILL_KEYS = [
  "vocals",
  "guitar",
  "bass",
  "drums",
  "songwriting",
  "composition",
  "performance",
  "creativity",
  "technical",
  "business",
  "marketing",
] as const;

const SKILL_LABELS: Record<SkillKey, string> = {
  vocals: "Vocals",
  guitar: "Guitar",
  bass: "Bass",
  drums: "Drums",
  songwriting: "Songwriting",
  composition: "Composition",
  performance: "Performance",
  creativity: "Creativity",
  technical: "Technical",
  business: "Business",
  marketing: "Marketing",
};

type SkillKey = (typeof SKILL_KEYS)[number];
type PlayerSkillsRow = Database["public"]["Tables"]["player_skills"]["Row"];
type SkillsUpdateInput = Database["public"]["Tables"]["player_skills"]["Update"];
type XpWalletRow = Database["public"]["Tables"]["player_xp_wallet"]["Row"];
type XpWalletUpdateInput = Database["public"]["Tables"]["player_xp_wallet"]["Update"];

const clampSkillScore = (value: number) => {
  if (!Number.isFinite(value)) {
    return 5;
  }

  return Math.max(5, Math.min(1000, Math.round(value)));
};

const createEmptyAllocation = () =>
  SKILL_KEYS.reduce((accumulator, key) => {
    accumulator[key] = "";
    return accumulator;
  }, {} as Record<SkillKey, string>);

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

const MyCharacterEdit = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { profile, skills, xpWallet, loading, updateProfile, updateSkills, updateXpWallet, refetch } =
    useGameData();

  const [allocationInputs, setAllocationInputs] = useState<Record<SkillKey, string>>(createEmptyAllocation);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [usernameInput, setUsernameInput] = useState(profile?.username ?? "");
  const [displayNameInput, setDisplayNameInput] = useState(profile?.display_name ?? "");
  const [bioInput, setBioInput] = useState(profile?.bio ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const availableXp = useMemo(() => {
    const rawValue = (xpWallet as XpWalletRow | null)?.xp_balance ?? 0;
    const numericValue = Number(rawValue ?? 0);
    return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
  }, [xpWallet]);

  const totalAllocated = useMemo(
    () =>
      SKILL_KEYS.reduce((sum, key) => {
        const rawValue = allocationInputs[key];
        if (!rawValue) {
          return sum;
        }

        const parsed = Number.parseInt(rawValue, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return sum;
        }

        return sum + parsed;
      }, 0),
    [allocationInputs],
  );

  const remainingXp = Math.max(0, availableXp - totalAllocated);

  const readSkillValue = (key: SkillKey) => {
    const value = (skills as PlayerSkillsRow | null)?.[key] ?? 0;
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) ? numericValue : 0;
  };

  const handleAllocationChange = (key: SkillKey, value: string) => {
    if (!value || value.trim().length === 0) {
      setAllocationInputs((previous) => ({ ...previous, [key]: "" }));
      return;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }

    setAllocationInputs((previous) => ({ ...previous, [key]: String(parsed) }));
  };

  const resetAllocation = () => {
    setAllocationInputs(createEmptyAllocation());
    setAllocationError(null);
  };

  const resetProfileForm = useCallback(() => {
    setUsernameInput(profile?.username ?? "");
    setDisplayNameInput(profile?.display_name ?? "");
    setBioInput(profile?.bio ?? "");
    setProfileError(null);
  }, [profile]);

  useEffect(() => {
    resetProfileForm();
  }, [resetProfileForm]);

  const handleAllocationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!skills) {
      setAllocationError("No skills available to update yet.");
      return;
    }

    if (!xpWallet || availableXp <= 0) {
      setAllocationError("You don't have any available XP to allocate right now.");
      return;
    }

    if (totalAllocated <= 0) {
      setAllocationError("Enter how much XP you want to allocate before saving.");
      return;
    }

    if (totalAllocated > availableXp) {
      setAllocationError("You can't allocate more XP than you currently have available.");
      return;
    }

    const skillUpdates: SkillsUpdateInput = {};
    let hasUpdates = false;

    for (const key of SKILL_KEYS) {
      const rawValue = allocationInputs[key];
      if (!rawValue) {
        continue;
      }

      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        continue;
      }

      const currentValue = readSkillValue(key);
      const nextValue = clampSkillScore(currentValue + parsed);
      skillUpdates[key] = nextValue;
      hasUpdates = true;
    }

    if (!hasUpdates) {
      setAllocationError("Nothing to update yet — try adding XP to at least one skill.");
      return;
    }

    setIsAllocating(true);
    setAllocationError(null);

    try {
      await updateSkills(skillUpdates);

      const currentWallet = xpWallet as XpWalletRow | null;
      const walletBalance = Number(currentWallet?.xp_balance ?? 0);
      const walletSpent = Number(currentWallet?.xp_spent ?? 0);

      const nextWallet: XpWalletUpdateInput = {
        xp_balance: Math.max(0, walletBalance - totalAllocated),
        xp_spent: Math.max(0, walletSpent + totalAllocated),
      };

      await updateXpWallet(nextWallet);
      await refetch();

      resetAllocation();
      toast({
        title: "Skills updated",
        description: `Allocated ${formatNumber(totalAllocated)} XP across your skills.`,
      });
    } catch (allocationError) {
      const message =
        allocationError instanceof Error
          ? allocationError.message
          : "We couldn't update your skills right now.";

      setAllocationError(message);
      toast({
        variant: "destructive",
        title: "Skill update failed",
        description: message,
      });
    } finally {
      setIsAllocating(false);
    }
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) {
      setProfileError("No profile available to update yet.");
      return;
    }

    const nextUsername = usernameInput.trim();
    const nextDisplayName = displayNameInput.trim();
    const nextBio = bioInput.trim();

    if (nextUsername.length === 0 || nextDisplayName.length === 0) {
      setProfileError("Username and display name are required.");
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);

    try {
      await updateProfile({
        username: nextUsername,
        display_name: nextDisplayName,
        bio: nextBio.length > 0 ? nextBio : null,
      });
      await refetch();

      setUsernameInput(nextUsername);
      setDisplayNameInput(nextDisplayName);
      setBioInput(nextBio);

      toast({
        title: "Profile updated",
        description: "Your character details have been saved.",
      });
    } catch (profileUpdateError) {
      const message =
        profileUpdateError instanceof Error
          ? profileUpdateError.message
          : "We couldn't update your profile right now.";

      setProfileError(message);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: message,
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!user) {
      setUploadError("You need to be signed in to upload a profile image.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const fileExtension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const fileName = `avatar-${Date.now()}.${fileExtension}`;
    const filePath = `${user.id}/${fileName}`;

    try {
      const { data, error } = await supabase.storage.from("avatars").upload(filePath, file, {
        upsert: true,
      });

      if (error) {
        throw error;
      }

      setUploadProgress(100);

      const { data: publicUrlData, error: publicUrlError } = supabase.storage
        .from("avatars")
        .getPublicUrl(data?.path ?? filePath);

      if (publicUrlError) {
        throw publicUrlError;
      }

      const avatarUrl = publicUrlData.publicUrl;
      await updateProfile({ avatar_url: avatarUrl });
      await refetch();

      toast({
        title: "Profile image updated",
        description: "Your avatar is looking sharp!",
      });
    } catch (uploadProblem) {
      const message =
        uploadProblem instanceof Error
          ? uploadProblem.message
          : "We couldn't upload your image. Please try again.";

      setUploadError(message);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: message,
      });
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 500);
      event.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span className="text-muted-foreground">Loading your character...</span>
      </div>
    );
  }

  const displayName = profile?.display_name || profile?.username || "Performer";
  const avatarUrl = profile?.avatar_url ?? undefined;
  const lifetimeXp = Number((xpWallet as XpWalletRow | null)?.lifetime_xp ?? 0);
  const xpSpent = Number((xpWallet as XpWalletRow | null)?.xp_spent ?? 0);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">My Character</h1>
        <p className="text-muted-foreground">Manage your profile image and allocate your hard-earned XP.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile details</CardTitle>
              <CardDescription>Update your username, display name, and bio.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-username">Username</Label>
                  <Input
                    id="profile-username"
                    value={usernameInput}
                    onChange={(event) => setUsernameInput(event.target.value)}
                    placeholder="rockstar123"
                    autoComplete="username"
                    disabled={isSavingProfile}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usernames help fans find you — keep it short and memorable.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-display-name">Display name</Label>
                  <Input
                    id="profile-display-name"
                    value={displayNameInput}
                    onChange={(event) => setDisplayNameInput(event.target.value)}
                    placeholder="The Midnight Echo"
                    autoComplete="name"
                    disabled={isSavingProfile}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the name shown throughout Rockmundo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-bio">Bio</Label>
                  <Textarea
                    id="profile-bio"
                    value={bioInput}
                    onChange={(event) => setBioInput(event.target.value)}
                    placeholder="Share your origin story, influences, and aspirations."
                    rows={4}
                    disabled={isSavingProfile}
                  />
                  <p className="text-xs text-muted-foreground">
                    A compelling bio helps labels and fans connect with your journey.
                  </p>
                </div>

                {profileError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Profile update issue</AlertTitle>
                    <AlertDescription>{profileError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetProfileForm} disabled={isSavingProfile}>
                    Reset
                  </Button>
                  <Button type="submit" disabled={isSavingProfile}>
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skill allocation</CardTitle>
              <CardDescription>Distribute available XP to grow your abilities.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAllocationSubmit} className="space-y-6">
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Available XP</p>
                  <p className="text-2xl font-semibold">{formatNumber(availableXp)}</p>
                  <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span>Allocated: {formatNumber(totalAllocated)}</span>
                    <span>Remaining: {formatNumber(remainingXp)}</span>
                  </div>
                </div>

                <div className="grid gap-4">
                  {SKILL_KEYS.map((key) => {
                    const currentValue = readSkillValue(key);
                    return (
                      <div
                        key={key}
                        className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                      >
                        <div>
                          <Label htmlFor={`skill-${key}`}>{SKILL_LABELS[key]}</Label>
                          <p className="text-sm text-muted-foreground">
                            Current: <span className="font-medium">{formatNumber(currentValue)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 sm:justify-end">
                          <Input
                            id={`skill-${key}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={allocationInputs[key]}
                            onChange={(event) => handleAllocationChange(key, event.target.value)}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {allocationError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Allocation issue</AlertTitle>
                    <AlertDescription>{allocationError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Updates take effect immediately after saving.</span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={resetAllocation} disabled={isAllocating}>
                      Reset
                    </Button>
                    <Button
                      type="submit"
                      disabled={isAllocating || totalAllocated === 0 || totalAllocated > availableXp}
                    >
                      {isAllocating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Allocate XP"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile overview</CardTitle>
              <CardDescription>Keep track of your character at a glance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-full border bg-muted">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={`${displayName} avatar`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-semibold">
                      {displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{displayName}</h2>
                  <p className="text-sm text-muted-foreground">Lifetime XP: {formatNumber(lifetimeXp)}</p>
                  <p className="text-sm text-muted-foreground">XP spent: {formatNumber(Math.max(0, xpSpent))}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Profile ID: {profile?.id ?? "N/A"}</p>
                <p>Username: {profile?.username ?? "N/A"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile image</CardTitle>
              <CardDescription>Upload a new avatar to personalize your character.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="avatar-upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Choose an image
              </Label>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarUpload}
                disabled={isUploading}
              />

              {uploadProgress !== null ? <Progress value={uploadProgress} className="h-2" /> : null}

              {uploadError ? (
                <Alert variant="destructive">
                  <AlertTitle>Upload issue</AlertTitle>
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              ) : null}

              {isUploading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading image...
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MyCharacterEdit;

