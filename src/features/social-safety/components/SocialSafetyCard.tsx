import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSocialSafety } from "../hooks/useSocialSafety";
import { socialReportCategoryLabels, type SocialReportCategory } from "../services/socialSafety";

interface SocialSafetyCardProps {
  viewerProfileId: string | null;
  isProfileLoading?: boolean;
}

const categoryOptions = Object.entries(socialReportCategoryLabels) as Array<[SocialReportCategory, string]>;

export function SocialSafetyCard({ viewerProfileId, isProfileLoading = false }: SocialSafetyCardProps) {
  const [targetProfileId, setTargetProfileId] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<SocialReportCategory>("harassment");
  const [reason, setReason] = useState("");
  const normalizedTarget = targetProfileId.trim() || null;
  const hasTarget = Boolean(normalizedTarget && normalizedTarget !== viewerProfileId);

  const safety = useSocialSafety(viewerProfileId, hasTarget ? normalizedTarget : null);
  const busy = safety.isBlocking || safety.isUnblocking || safety.isMuting || safety.isUnmuting || safety.isReporting;
  const noteTooLong = note.trim().length > 280;
  const canSubmitAction = Boolean(viewerProfileId && hasTarget && !busy && !noteTooLong);
  const canSubmitReport = canSubmitAction && reason.trim().length >= 10 && reason.trim().length <= 2000;

  const statusText = useMemo(() => {
    if (!hasTarget) return "Enter a profile target to review available safety actions.";
    if (safety.isLoading) return "Checking current block and mute status…";
    if (safety.data?.isBlocked) return "Blocked: this player cannot pass shared contact guards.";
    if (safety.data?.isMuted) return "Muted: future feeds and notifications can suppress this player.";
    return "No active block or mute for this target.";
  }, [hasTarget, safety.data?.isBlocked, safety.data?.isMuted, safety.isLoading]);

  const runAction = async (action: "block" | "unblock" | "mute" | "unmute" | "report") => {
    try {
      if (action === "block") await safety.blockProfile({ note });
      if (action === "unblock") await safety.unblockProfile();
      if (action === "mute") await safety.muteProfile({ note });
      if (action === "unmute") await safety.unmuteProfile();
      if (action === "report") {
        await safety.reportSocialTarget({
          reportedProfileId: normalizedTarget,
          targetType: "profile",
          category,
          reason,
          context: { surface: "relationships_social_safety_card" },
        });
        setReason("");
      }
      toast.success(action === "report" ? "Report submitted for moderator review" : "Social safety preference updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete that safety action");
    }
  };

  if (!viewerProfileId && !isProfileLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Social Safety</CardTitle>
          <CardDescription>Sign in and select a character to block, mute, or report social abuse.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isProfileLoading) {
    return (
      <Card aria-busy="true">
        <CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-full max-w-xl" /></CardHeader>
        <CardContent className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" /> Social Safety</CardTitle>
        <CardDescription>
          Block, mute, or report another player. These actions are private, retry-safe, and do not grant gameplay rewards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.5fr)]">
          <div className="space-y-2">
            <Label htmlFor="social-safety-target">Target profile ID</Label>
            <Input
              id="social-safety-target"
              value={targetProfileId}
              onChange={(event) => setTargetProfileId(event.target.value)}
              placeholder="Paste the profile ID from a profile or message context"
              disabled={busy}
              aria-describedby="social-safety-status"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="social-safety-note">Private note</Label>
            <Input id="social-safety-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} disabled={busy} placeholder="Optional" />
          </div>
        </div>

        <p id="social-safety-status" className="text-xs text-muted-foreground" role="status">{statusText}</p>
        {noteTooLong ? <p className="text-xs text-destructive">Notes must be 280 characters or fewer.</p> : null}
        {safety.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Could not load safety status</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{safety.error instanceof Error ? safety.error.message : "Try again before changing this relationship."}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void safety.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="destructive" disabled={!canSubmitAction || safety.data?.isBlocked} onClick={() => void runAction("block")}>
            {safety.isBlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />} Block
          </Button>
          <Button type="button" variant="outline" disabled={!canSubmitAction || !safety.data?.isBlocked} onClick={() => void runAction("unblock")}>Unblock</Button>
          <Button type="button" variant="secondary" disabled={!canSubmitAction || safety.data?.isMuted || safety.data?.isBlocked} onClick={() => void runAction("mute")}>
            {safety.isMuting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <VolumeX className="mr-2 h-4 w-4" />} Mute
          </Button>
          <Button type="button" variant="outline" disabled={!canSubmitAction || !safety.data?.isMuted} onClick={() => void runAction("unmute")}>Unmute</Button>
        </div>

        <div className="rounded-md border border-border/80 p-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
            <div className="space-y-2">
              <Label htmlFor="social-report-category">Report category</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as SocialReportCategory)} disabled={busy}>
                <SelectTrigger id="social-report-category"><SelectValue /></SelectTrigger>
                <SelectContent>{categoryOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-report-reason">What happened?</Label>
              <Textarea id="social-report-reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} maxLength={2000} placeholder="Give moderators enough context to review the issue." />
              <p className="text-xs text-muted-foreground">{reason.trim().length}/2000 characters. Minimum 10.</p>
            </div>
          </div>
          <Button type="button" disabled={!canSubmitReport} onClick={() => void runAction("report")}>
            {safety.isReporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Submit report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
