import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DEFAULT_CROWD_TUNING,
  crowdTuningSignature,
  type CrowdTuningOptions,
} from "./engine/CrowdTuning";
import {
  useGlobalCrowdTuning,
  useRestoreGlobalCrowdTuning,
  useSaveGlobalCrowdTuning,
} from "./hooks/useGlobalCrowdTuning";

export function GlobalCrowdDefaultsControls({
  value,
  onLoad,
}: {
  value: CrowdTuningOptions;
  onLoad: (value: CrowdTuningOptions) => void;
}) {
  const globalQuery = useGlobalCrowdTuning(true);
  const saveMutation = useSaveGlobalCrowdTuning();
  const restoreMutation = useRestoreGlobalCrowdTuning();
  const [saveOpen, setSaveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [saveReason, setSaveReason] = useState("");
  const [restoreReason, setRestoreReason] = useState("");

  const global = globalQuery.data;
  const matchesGlobal = useMemo(
    () => !!global && crowdTuningSignature(global.settings) === crowdTuningSignature(value),
    [global, value],
  );
  const isBusy = saveMutation.isPending || restoreMutation.isPending;

  const save = async () => {
    if (saveReason.trim().length < 8) return;
    try {
      await saveMutation.mutateAsync({ settings: value, reason: saveReason.trim() });
      setSaveOpen(false);
      setSaveReason("");
    } catch {
      // Mutation feedback is shown by the hook; keep the dialog open for retry.
    }
  };

  const restore = async () => {
    if (restoreReason.trim().length < 8) return;
    try {
      const result = await restoreMutation.mutateAsync({ reason: restoreReason.trim() });
      onLoad(result.settings);
      setRestoreOpen(false);
      setRestoreReason("");
    } catch {
      // Mutation feedback is shown by the hook; keep the dialog open for retry.
    }
  };

  return (
    <section className="mb-3 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4" aria-label="Global crowd defaults">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Global gig crowd defaults</h3>
          <p className="text-sm text-muted-foreground">
            Save the current demo settings for normal gigs. New replays snapshot the active revision so later edits do not change them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {global ? <Badge variant="outline">Revision {global.revision}</Badge> : null}
          <Badge variant={matchesGlobal ? "secondary" : "outline"}>
            {matchesGlobal ? "Demo matches global" : "Unsaved demo changes"}
          </Badge>
        </div>
      </div>

      {globalQuery.isError ? (
        <p className="text-sm text-destructive">
          Global settings could not be loaded. Apply the database migration before using the production save controls.
        </p>
      ) : null}

      {global ? (
        <p className="text-xs text-muted-foreground">
          Last change: {global.reason ?? "No reason recorded"}
          {global.updatedAt ? ` · ${new Date(global.updatedAt).toLocaleString()}` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!global || isBusy}
          onClick={() => global && onLoad(global.settings)}
        >
          Load global into demo
        </Button>

        <AlertDialog open={saveOpen} onOpenChange={setSaveOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" disabled={isBusy || globalQuery.isError || matchesGlobal}>
              Save as global default
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace the global gig crowd defaults?</AlertDialogTitle>
              <AlertDialogDescription>
                These settings will be used for every newly generated gig replay. Existing replays with a saved crowd revision remain unchanged; older unsnapshotted replays receive this revision once.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="crowd-default-save-reason">Reason for this change</Label>
              <Textarea
                id="crowd-default-save-reason"
                value={saveReason}
                onChange={(event) => setSaveReason(event.target.value)}
                placeholder="Describe why these crowd defaults are changing"
                maxLength={240}
              />
              <p className="text-xs text-muted-foreground">Minimum 8 characters. This is stored in the admin audit log.</p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saveMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={saveReason.trim().length < 8 || saveMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                {saveMutation.isPending ? "Saving…" : "Save global defaults"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={isBusy || globalQuery.isError}>
              Restore system defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore the original production crowd defaults?</AlertDialogTitle>
              <AlertDialogDescription>
                This creates a new global revision using the built-in production values. It does not rewrite replays that already have a crowd tuning snapshot.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="crowd-default-restore-reason">Reason for restoring</Label>
              <Textarea
                id="crowd-default-restore-reason"
                value={restoreReason}
                onChange={(event) => setRestoreReason(event.target.value)}
                placeholder="Describe why the system defaults are being restored"
                maxLength={240}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={restoreMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={restoreReason.trim().length < 8 || restoreMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  void restore();
                }}
              >
                {restoreMutation.isPending ? "Restoring…" : "Restore defaults"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <p className="text-xs text-muted-foreground">
        Built-in fallback: density {DEFAULT_CROWD_TUNING.densityMultiplier}×, depth {DEFAULT_CROWD_TUNING.depthSpread}×, lateral {DEFAULT_CROWD_TUNING.lateralSpread}×.
      </p>
    </section>
  );
}
