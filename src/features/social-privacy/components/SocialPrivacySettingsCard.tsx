import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useSocialPrivacySettings } from "../hooks/useSocialPrivacySettings";
import type { SocialPrivacySettingsUpdate } from "../services/socialPrivacySettings";

const visibilityOptions = [
  { value: "public", label: "Public", help: "Visible to anyone who can view social surfaces." },
  { value: "friends", label: "Friends only", help: "Reserved for accepted friends once guarded reads are wired in." },
  { value: "private", label: "Private", help: "Hidden from public discovery and future social reads." },
] as const;

const dmOptions = [
  { value: "everyone", label: "Everyone" },
  { value: "friends", label: "Friends only" },
  { value: "none", label: "No one" },
] as const;

const fieldConfig = [
  { key: "profileVisibility", label: "Profile highlight reel", description: "Controls the public-safe profile summary used by future discovery." },
  { key: "cityVisibility", label: "Current city", description: "Prevents location-style social discovery from becoming mandatory." },
  { key: "activityVisibility", label: "Current activity", description: "Controls future display of what your character is doing now." },
  { key: "onlineStatusVisibility", label: "Online status", description: "Defaults private so presence remains opt-in." },
  { key: "relationshipVisibility", label: "Relationship details", description: "Controls future friend/band/company relationship indicators." },
] satisfies Array<{ key: keyof Pick<SocialPrivacySettingsUpdate, "profileVisibility" | "cityVisibility" | "activityVisibility" | "onlineStatusVisibility" | "relationshipVisibility">; label: string; description: string }>;

interface SocialPrivacySettingsCardProps {
  profileId: string | null;
  isProfileLoading?: boolean;
}

export function SocialPrivacySettingsCard({ profileId, isProfileLoading = false }: SocialPrivacySettingsCardProps) {
  const { data, isLoading, isError, error, refetch, saveSettings, isSaving } = useSocialPrivacySettings(profileId);
  const [draft, setDraft] = useState<SocialPrivacySettingsUpdate | null>(null);

  useEffect(() => {
    if (data) {
      setDraft({
        profileVisibility: data.profileVisibility,
        cityVisibility: data.cityVisibility,
        activityVisibility: data.activityVisibility,
        onlineStatusVisibility: data.onlineStatusVisibility,
        relationshipVisibility: data.relationshipVisibility,
        dmPermission: data.dmPermission,
        allowBandInvites: data.allowBandInvites,
        allowCompanyInvites: data.allowCompanyInvites,
      });
    }
  }, [data]);

  const hasChanges = useMemo(() => {
    if (!draft || !data) return false;
    return Object.entries(draft).some(([key, value]) => data[key as keyof SocialPrivacySettingsUpdate] !== value);
  }, [data, draft]);

  const disabled = !profileId || isProfileLoading || isLoading || isSaving || !draft;

  const updateField = <Key extends keyof SocialPrivacySettingsUpdate>(key: Key, value: SocialPrivacySettingsUpdate[Key]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const handleSave = async () => {
    if (!profileId || !draft || isSaving || !hasChanges) return;
    try {
      await saveSettings(draft);
      toast.success("Social privacy settings saved");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save social privacy settings");
    }
  };

  if (!profileId && !isProfileLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Social Privacy Settings</CardTitle>
          <CardDescription>Sign in and select a character to manage social visibility.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isProfileLoading || isLoading) {
    return (
      <Card aria-busy="true">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Could not load social privacy settings</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error instanceof Error ? error.message : "Please try again before changing social visibility."}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social Privacy Settings</CardTitle>
          <CardDescription>No settings exist yet; safe defaults will be created when you save.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Social Privacy Settings</CardTitle>
        <CardDescription>
          Choose what future social discovery, contact, and recruitment flows may expose. Blocks still take priority over every contact option.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fieldConfig.map((field) => (
            <div key={field.key} className="rounded-md border border-border/80 p-3 space-y-2">
              <Label htmlFor={`social-privacy-${field.key}`} className="text-sm font-medium">{field.label}</Label>
              <p className="text-xs text-muted-foreground">{field.description}</p>
              <Select
                value={draft[field.key]}
                onValueChange={(value) => updateField(field.key, value as SocialPrivacySettingsUpdate[typeof field.key])}
                disabled={disabled}
              >
                <SelectTrigger id={`social-privacy-${field.key}`} aria-label={field.label}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibilityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="rounded-md border border-border/80 p-3 space-y-2">
            <Label htmlFor="social-privacy-dmPermission" className="text-sm font-medium">Direct messages</Label>
            <p className="text-xs text-muted-foreground">Future DM send guards will use this preference plus block checks.</p>
            <Select value={draft.dmPermission} onValueChange={(value) => updateField("dmPermission", value as SocialPrivacySettingsUpdate["dmPermission"])} disabled={disabled}>
              <SelectTrigger id="social-privacy-dmPermission" aria-label="Direct messages"><SelectValue /></SelectTrigger>
              <SelectContent>{dmOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border/80 p-3 flex items-center justify-between gap-3">
            <div><Label htmlFor="allow-band-invites">Allow band invitations</Label><p className="text-xs text-muted-foreground">Disabled means future band invite guards should reject unsolicited invites.</p></div>
            <Switch id="allow-band-invites" checked={draft.allowBandInvites} onCheckedChange={(checked) => updateField("allowBandInvites", checked)} disabled={disabled} />
          </div>
          <div className="rounded-md border border-border/80 p-3 flex items-center justify-between gap-3">
            <div><Label htmlFor="allow-company-invites">Allow company invitations</Label><p className="text-xs text-muted-foreground">Disabled means future hiring/contact guards should reject unsolicited company invites.</p></div>
            <Switch id="allow-company-invites" checked={draft.allowCompanyInvites} onCheckedChange={(checked) => updateField("allowCompanyInvites", checked)} disabled={disabled} />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground" role="status">
            {hasChanges ? "Unsaved changes" : "Settings are up to date"}
          </p>
          <Button type="button" onClick={() => void handleSave()} disabled={disabled || !hasChanges}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? "Saving…" : "Save privacy settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
