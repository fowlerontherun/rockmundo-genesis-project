import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CalendarDays, Radio } from "lucide-react";
import { getTotpEpisode } from "@/features/top-of-the-pops/api";
import { TotpControlRoomCard } from "@/features/top-of-the-pops/TotpControlRoomCard";
import { TotpProductionHealthCard } from "@/features/top-of-the-pops/TotpProductionHealthCard";
import { TotpRunningSheetCard } from "@/features/top-of-the-pops/TotpRunningSheetCard";
import { TotpRenderQueueCard } from "@/features/top-of-the-pops/TotpRenderQueueCard";
import { TotpYoutubePublishCard } from "@/features/top-of-the-pops/TotpYoutubePublishCard";
import { resolveTotpPresenter } from "@/features/top-of-the-pops/presenters";

export default function TopOfThePopsControlRoom() {
  const episode = useQuery({
    queryKey: ["totp", "episode", "admin-current"],
    queryFn: () => getTotpEpisode(),
  });

  const current = episode.data ?? null;
  const presenter = current ? resolveTotpPresenter((current as unknown as { presenter_key?: string }).presenter_key) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="h-4 w-4" /> Television administration
          </div>
          <h1 className="text-3xl font-bold">Control room</h1>
          <p className="text-muted-foreground">
            {current
              ? `Episode #${current.episode_number}${presenter ? ` · ${presenter.displayName}` : ""}`
              : "No episode is currently scheduled."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/top-of-the-pops">
              <ArrowLeft className="mr-1 h-4 w-4" /> Episode admin
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/top-of-the-pops/schedule">
              <CalendarDays className="mr-1 h-4 w-4" /> Broadcast schedule
            </Link>
          </Button>
        </div>
      </div>

      <TotpProductionHealthCard />

      {episode.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading the episode…</CardContent>
        </Card>
      ) : episode.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{(episode.error as Error).message}</CardContent>
        </Card>
      ) : current ? (
        <>
          <TotpControlRoomCard episode={current} />
          <TotpRunningSheetCard episode={current} />
          <TotpRenderQueueCard episode={current} />
          <TotpYoutubePublishCard episode={current} />
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Schedule an episode on the broadcast schedule page to use the control room.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
