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

  return (
    <SimplifiedFestivalLineupManager
      festivalCompanyId={festivalCompanyId}
      festivalEditionId={festivalEditionId}
      data={query.data}
    />
  );
}
