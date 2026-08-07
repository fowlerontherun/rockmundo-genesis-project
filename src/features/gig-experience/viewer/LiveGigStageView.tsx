import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { buildGigViewerReplay } from "../events/generator";
import { metricValue } from "../reportMetric";
import type { GigExperienceDTO } from "../types";
import type { GigViewerReplay } from "../events/types";
import { GigViewerShell } from "./GigViewerShell";

/**
 * Presentation-only bridge so live and freshly completed gigs render with the
 * same updated viewer engine as the admin demo. When no stored canonical replay
 * exists yet, a deterministic replay is generated client-side from the gig
 * experience DTO. No game records are read or written here beyond the DTO.
 */
export function LiveGigStageView({
  gigId,
  experience,
  onViewResult,
  onClose,
}: {
  gigId: string;
  experience: GigExperienceDTO;
  onViewResult: () => void;
  onClose: () => void;
}) {
  const [replay, setReplay] = useState<GigViewerReplay | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setReplay(null);
    setFailed(false);
    buildGigViewerReplay({
      replayId: `local-${gigId}`,
      outcomeId: experience.viewer.outcomeId ?? `local-${gigId}`,
      generatedAt: new Date().toISOString(),
      gig: {
        id: gigId,
        completedAt: experience.gig.completedAt ?? new Date().toISOString(),
        actualAttendance: metricValue(experience.headline.attendance, 0),
        venueCapacity: experience.gig.venue.capacity,
        overallRating: metricValue(experience.headline.overallRating, 0),
        netProfit: metricValue(experience.finances.netProfit, 0),
      },
      songs: experience.songs.map((song) => ({
        id: song.id,
        songId: song.songId,
        title: song.title,
        position: song.position - 1,
        performanceScore: metricValue(song.performanceScore, 0),
      })),
      performers: experience.performers.map((performer) => ({
        profileId: performer.profileId,
        displayName: performer.displayName,
        roleOrInstrument: performer.roleOrInstrument,
      })),
    })
      .then((built) => {
        if (alive) setReplay(built as GigViewerReplay);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [gigId, experience]);

  if (failed) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          The stage view could not be prepared for this performance.
        </CardContent>
      </Card>
    );
  }

  if (!replay) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Preparing stage view…
        </CardContent>
      </Card>
    );
  }

  return (
    <GigViewerShell
      gigId={gigId}
      experience={experience}
      open
      replayOverride={replay}
      onViewResult={onViewResult}
      onClose={onClose}
    />
  );
}
