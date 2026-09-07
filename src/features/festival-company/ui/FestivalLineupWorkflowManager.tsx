import { Music2, ShieldCheck, Star, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFestivalArtistProgramme } from "../application/useFestivalArtistProgramme";
import type { ArtistIdentity, FestivalArtistBooking } from "../domain/festivalArtistProgramme";
import { FestivalAdvancedArtistSearch } from "./FestivalAdvancedArtistSearch";
import { FestivalOwnerLineupControls } from "./FestivalOwnerLineupControls";
import { SimplifiedFestivalLineupManager } from "./SimplifiedFestivalLineupManager";

const artistLabel = (identity: ArtistIdentity) => {
  if (identity.type === "band") return "Confirmed band";
  if (identity.type === "solo") return "Confirmed solo artist";
  return "NPC / guest act";
};

const billingLabel = (booking: FestivalArtistBooking) =>
  booking.billingPosition.replaceAll("_", " ");

export function FestivalLineupWorkflowManager({
  festivalCompanyId,
  festivalEditionId,
}: {
  festivalCompanyId: string;
  festivalEditionId: string;
}) {
  const query = useFestivalArtistProgramme(
    festivalCompanyId,
    festivalEditionId,
  );

  if (query.isLoading) {
    return <p role="status">Loading Festival line-up…</p>;
  }

  if (query.isError || !query.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Line-up unavailable</CardTitle>
          <CardDescription>
            The annual Festival line-up could not be loaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Refresh this page before inviting acts or reviewing applications. Your
          saved Festival plan has not been changed.
        </CardContent>
      </Card>
    );
  }

  const data = query.data;
  const requiresConfirmedAct = data.issues.some(
    (issue) =>
      issue.blocking && issue.code === "festival_lineup_requires_confirmed_act",
  );
  const confirmed = data.bookings.filter((booking) =>
    ["confirmed", "awaiting_schedule", "scheduled"].includes(booking.status),
  );
  const headliners = confirmed.filter((booking) => booking.billingPosition === "headliner");

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/30 bg-primary/5">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <Badge variant={data.canWrite ? "secondary" : "outline"}>
              <ShieldCheck className="mr-1 h-3 w-3" />
              {data.canWrite ? "Festival management access" : "Read-only line-up"}
            </Badge>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Live line-up poster
          </p>
          <CardTitle className="text-3xl">{data.festivalName}</CardTitle>
          <CardDescription>
            {data.festivalDates.join(" · ") || "Dates to be confirmed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Headliners</p>
            {headliners.length ? (
              <div className="flex flex-wrap justify-center gap-2">
                {headliners.map((booking) => (
                  <Badge key={booking.id} className="px-4 py-2 text-base">
                    <Star className="mr-2 h-4 w-4" /> {artistLabel(booking.identity)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-lg font-semibold text-muted-foreground">HEADLINER REQUIRED</p>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {confirmed.filter((booking) => booking.billingPosition !== "headliner").map((booking) => (
              <div key={booking.id} className="rounded-md border bg-background/70 p-3 text-left">
                <p className="font-semibold">{artistLabel(booking.identity)}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {billingLabel(booking)} · {booking.setMinutes} min set
                </p>
              </div>
            ))}
            {confirmed.length === 0 ? (
              <div className="col-span-full rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                Your poster is empty. Review applications or invite the first act below.
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Music2 className="h-4 w-4" /> {confirmed.length} confirmed</span>
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {data.playerArtistCount} player acts</span>
            <span>{data.npcArtistCount} NPC acts</span>
            <span>{data.stages.length} stage{data.stages.length === 1 ? "" : "s"}</span>
          </div>
        </CardContent>
      </Card>

      {requiresConfirmedAct ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle>Confirm at least one act</CardTitle>
            <CardDescription>
              Invite an act or review an application, send a performance offer
              and wait for it to be accepted. Once one act is confirmed, the
              game can fill remaining Festival slots with suitable NPC acts.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <FestivalAdvancedArtistSearch
        festivalCompanyId={festivalCompanyId}
        festivalEditionId={festivalEditionId}
        festivalDates={data.festivalDates}
        currencyCode={data.programme?.currencyCode ?? "GBP"}
        preferredGenres={data.programme?.preferredGenres ?? []}
      />

      <SimplifiedFestivalLineupManager
        festivalCompanyId={festivalCompanyId}
        festivalEditionId={festivalEditionId}
        data={data}
      />

      {data.canWrite ? (
        <FestivalOwnerLineupControls
          festivalCompanyId={festivalCompanyId}
          festivalEditionId={festivalEditionId}
        />
      ) : null}
    </div>
  );
}
