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

  if (query.isLoading || query.isError || !query.data) return null;

  return (
    <SimplifiedFestivalLineupManager
      festivalCompanyId={festivalCompanyId}
      festivalEditionId={festivalEditionId}
      data={query.data}
    />
  );
}
