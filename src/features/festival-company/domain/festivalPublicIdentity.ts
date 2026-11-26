import type { FestivalPlayerAttendance } from "../attendance/festivalAttendance";
import type { FestivalMemorabiliaItem } from "../attendance/festivalAttendeeExtras";
import type { FestivalPublicEdition } from "./festivalLaunch";

/** Public-edition, launch and annual-edition UUIDs are distinct identities.
 * Never match a ticket or attendance to a public-edition UUID by accident. */
export function attendanceForPublicFestival(
  festival: FestivalPublicEdition,
  attendances: FestivalPlayerAttendance[],
): FestivalPlayerAttendance | undefined {
  if (!festival.editionId) return undefined;
  return attendances
    .filter(item => item.festivalEditionId === festival.editionId
      && item.festivalSlug === festival.slug
      && (!festival.festivalLaunchId || item.festivalLaunchId === festival.festivalLaunchId)
      && item.status !== "cancelled" && item.status !== "refunded")
    .sort((a, b) => Number(b.status === "attending") - Number(a.status === "attending"))[0];
}

export function wristbandForPublicFestival(
  attendance: FestivalPlayerAttendance | undefined,
  memorabilia: FestivalMemorabiliaItem[],
): FestivalMemorabiliaItem | undefined {
  if (!attendance) return undefined;
  return memorabilia.find(item => item.attendanceId === attendance.id
    && item.festivalEditionId === attendance.festivalEditionId
    && item.festivalLaunchId === attendance.festivalLaunchId);
}
