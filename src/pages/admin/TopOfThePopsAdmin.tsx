import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  adminBuildTotpBroadcastArchive,
  adminCompleteTotpPerformance,
  adminLockTotpRunningOrder,
  getTotpBroadcastArchive,
  getTotpEpisode,
  getTotpPublicHistory,
} from "@/features/top-of-the-pops/api";
import { TotpAdminDemo } from "@/features/top-of-the-pops/TotpAdminDemo";
import { resolveTotpPresenter, totpVariantLabel } from "@/features/top-of-the-pops/presenters";
import { Archive, CheckCircle2, Clapperboard, LockKeyhole, Tv2 } from "lucide-react";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function AdminHeading({ subtitle }: { subtitle: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><Tv2 className="h-4 w-4" /> Television administration</div>
      <h1 className="text-3xl font-bold">Top of the Pops</h1>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export default function TopOfThePopsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const episode = useQuery({
    queryKey: ["totp", "episode", "admin-current"],
    queryFn: () => getTotpEpisode(),
  });
  const currentId = episode.data?.id ?? null;
  const archive = useQuery({
    queryKey: ["totp", "archive", currentId],
    queryFn: () => getTotpBroadcastArchive(currentId),
    enabled: !!currentId,
  });
  const history = useQuery({
    queryKey: ["totp", "history", "admin-current"],
    queryFn: () => getTotpPublicHistory(null, 200),
    enabled: !!currentId,
  });

  const lockOrder = useMutation({
    mutationFn: adminLockTotpRunningOrder,
    onSuccess: (count) => {
      toast({ title: "Running order locked", description: `${count} checked-in act${count === 1 ? "" : "s"} added to the broadcast.` });
      void queryClient.invalidateQueries({ queryKey: ["totp"] });
    },
    onError: (error: Error) => toast({ title: "Could not lock running order", description: error.message, variant: "destructive" }),
  });

  const buildArchive = useMutation({
    mutationFn: adminBuildTotpBroadcastArchive,
    onSuccess: (count) => {
      toast({ title: "Broadcast archive locked", description: `${count} canonical performance replay${count === 1 ? "" : "s"} are now stored.` });
      void queryClient.invalidateQueries({ queryKey: ["totp", "archive"] });
    },
    onError: (error: Error) => toast({ title: "Could not build archive", description: error.message, variant: "destructive" }),
  });

  const completePerformance = useMutation({
    mutationFn: (performanceId: string) => adminCompleteTotpPerformance(performanceId),
    onSuccess: (result) => {
      toast({
        title: result.status === "already_completed" ? "Already settled" : "Performance completed",
        description: `Appearance #${result.appearance_number} · ${result.fame_awarded.toLocaleString()} fame awarded.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp"] });
    },
    onError: (error: Error) => toast({ title: "Could not complete performance", description: error.message, variant: "destructive" }),
  });

  if (episode.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <AdminHeading subtitle="Loading live broadcast state…" />
        <TotpAdminDemo />
      </div>
    );
  }

  if (episode.isError) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <AdminHeading subtitle="The production demo remains available while live episode data is unavailable." />
        <TotpAdminDemo />
        <Card className="border-destructive/40"><CardContent className="p-6 text-sm text-destructive">{(episode.error as Error).message}</CardContent></Card>
      </div>
    );
  }

  const current = episode.data;
  if (!current) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <AdminHeading subtitle="No live episode is scheduled yet. Use the studio demo below to inspect the broadcast experience." />
        <TotpAdminDemo />
        <Card>
          <CardHeader><CardTitle>Live broadcast control</CardTitle><CardDescription>The fortnightly scheduler will create an eligible episode from the locked UK chart snapshot.</CardDescription></CardHeader>
          <CardContent className="text-sm text-muted-foreground">No scheduled Top of the Pops episode found. The demo above is synthetic and does not create a real episode.</CardContent>
        </Card>
      </div>
    );
  }

  const presenter = resolveTotpPresenter((current as any).presenter_key);
  const variantLabel = totpVariantLabel((current as any).show_variant);
  const completedByPerformance = new Map(
    (history.data ?? []).filter((row) => row.episode_number === current.episode_number).map((row) => [row.performance_id, row]),
  );
  const allPerformancesSettled = current.performances.length > 0 && completedByPerformance.size === current.performances.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <AdminHeading subtitle={`Episode #${current.episode_number} · ${formatDateTime(current.broadcast_at)} · ${presenter.displayName}`} />
        <div className="flex flex-wrap gap-2">
          {variantLabel && <Badge variant="outline">{variantLabel}</Badge>}
          <Badge variant="secondary">{current.status}</Badge>
        </div>
      </div>

      <TotpAdminDemo />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clapperboard className="h-5 w-5" /> Broadcast controls</CardTitle>
          <CardDescription>
            {presenter.displayName} presents this {variantLabel ? `${variantLabel.toLowerCase()} ` : ""}episode. Lock the running order, complete and settle every performance, then freeze the canonical archive. The final replay snapshots the presenter, edition, live-TV incident, recovery, performance style and studio-audience reaction; replaying it never settles rewards.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => lockOrder.mutate(current.id)}
            disabled={lockOrder.isPending || current.status === "completed" || current.status === "cancelled"}
          >
            <LockKeyhole className="mr-2 h-4 w-4" /> Lock running order
          </Button>
          <Button
            variant="outline"
            onClick={() => buildArchive.mutate(current.id)}
            disabled={buildArchive.isPending || !allPerformancesSettled}
            title={allPerformancesSettled ? "Build the immutable television replay" : "Settle every performance before archiving"}
          >
            <Archive className="mr-2 h-4 w-4" /> Build canonical archive
          </Button>
          <Badge variant="secondary" className="self-center">
            {archive.data?.replays.length ?? 0}/{current.performances.length} archived
          </Badge>
          <Badge variant="secondary" className="self-center">
            {completedByPerformance.size}/{current.performances.length} settled
          </Badge>
          {!allPerformancesSettled && current.performances.length > 0 && (
            <span className="self-center text-xs text-muted-foreground">Archive unlocks after every act is settled.</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published running order</CardTitle>
          <CardDescription>{current.performances.length} act{current.performances.length === 1 ? "" : "s"} currently in the show.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {current.performances.length === 0 && <p className="text-sm text-muted-foreground">No acts have been locked into the broadcast yet.</p>}
          {current.performances.map((performance) => {
            const archived = archive.data?.replays.some((replay) => replay.performance_id === performance.performance_id) ?? false;
            const settled = completedByPerformance.get(performance.performance_id);
            return (
              <div key={performance.performance_id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold">{performance.running_order}. {performance.band_name}</div>
                    <div className="text-sm text-muted-foreground">{performance.song_title} · chart #{performance.qualifying_rank}</div>
                    {performance.presenter_intro && <div className="mt-2 text-sm italic">“{performance.presenter_intro}”</div>}
                    {settled && (
                      <div className="mt-2 text-sm font-medium text-emerald-600">
                        Appearance #{settled.appearance_number} · +{settled.fame_awarded.toLocaleString()} fame
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{performance.stage_key.replaceAll("_", " ")}</Badge>
                    {archived && <Badge variant="secondary">archived</Badge>}
                    {settled ? (
                      <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> settled</Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => completePerformance.mutate(performance.performance_id)}
                        disabled={completePerformance.isPending}
                      >
                        Complete & settle
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
