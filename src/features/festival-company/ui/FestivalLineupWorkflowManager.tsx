import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFestivalArtistProgramme } from "../application/useFestivalArtistProgramme";
import { SimplifiedFestivalLineupManager } from "./SimplifiedFestivalLineupManager";

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

  const requiresConfirmedAct = query.data.issues.some(
    (issue) =>
      issue.blocking && issue.code === "festival_lineup_requires_confirmed_act",
  );

  return (
    <div className="space-y-4">
      {requiresConfirmedAct ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle>Confirm at least one act</CardTitle>
            <CardDescription>
              Invite an act or review an application, send a performance offer
              and wait for it to be accepted. Once one act is confirmed, the
              game can fill the remaining Festival slots with suitable NPC acts.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <SimplifiedFestivalLineupManager
        festivalCompanyId={festivalCompanyId}
        festivalEditionId={festivalEditionId}
        data={query.data}
      />
    </div>
  );
}
