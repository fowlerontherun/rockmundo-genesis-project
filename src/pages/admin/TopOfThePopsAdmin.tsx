import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { adminBuildTotpBroadcastArchive, adminLockTotpRunningOrder, getTotpBroadcastArchive, getTotpEpisode } from "@/features/top-of-the-pops/api";
import { Archive, Clapperboard, LockKeyhole, Tv2 } from "lucide-react";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
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

  if (episode.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading Top of the Pops episode…</div>;
  }

  if (episode.isError) {
    return <div className="p-6 text-sm text-destructive">{(episode.error as Error).message}</div>;
  }

  const current = episode.data;
  if (!current) {
    return <div className="p-6"><Card><CardContent className="p-6">No scheduled Top of the Pops episode found.</CardContent></Card></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><Tv2 className="h-4 w-4" /> Television administration</div>
          <h1 className="text-3xl font-bold">Top of the Pops</h1>
          <p className="text-muted-foreground">Episode #{current.episode_number} · {formatDateTime(current.broadcast_at)}</p>
        </div>
        <Badge variant="secondary">{current.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clapperboard className="h-5 w-5" /> Broadcast controls</CardTitle>
          <CardDescription>
            Lock the running order first, then freeze the canonical broadcast archive. Archive generation never awards fame, XP or money.
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
            disabled={buildArchive.isPending || current.performances.length === 0}
          >
            <Archive className="mr-2 h-4 w-4" /> Build canonical archive
          </Button>
          <Badge variant="secondary" className="self-center">
            {archive.data?.replays.length ?? 0}/{current.performances.length} archived
          </Badge>
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
            return (
              <div key={performance.performance_id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold">{performance.running_order}. {performance.band_name}</div>
                    <div className="text-sm text-muted-foreground">{performance.song_title} · chart #{performance.qualifying_rank}</div>
                    {performance.presenter_intro && <div className="mt-2 text-sm italic">“{performance.presenter_intro}”</div>}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{performance.stage_key.replaceAll("_", " ")}</Badge>
                    {archived && <Badge variant="secondary">archived</Badge>}
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
