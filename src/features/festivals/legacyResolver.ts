import {
  getFestivalEdition,
  resolveEditionFromLegacyIdentifier,
} from "./service";
import type { FestivalEdition, FestivalLegacySource } from "./types";

export type LegacyEditionResolution = {
  editionId: string;
  festivalId: string;
  legacySource: FestivalLegacySource;
  legacyId: string;
  isLegacyRoute: boolean;
  edition: FestivalEdition | null;
};

export async function resolveLegacyFestivalEdition(params: {
  legacyId: string;
  legacySource?: FestivalLegacySource;
}): Promise<LegacyEditionResolution | null> {
  const source = params.legacySource ?? "dedicated_festival_row";
  const mapping = await resolveEditionFromLegacyIdentifier(
    source,
    params.legacyId,
  );
  if (!mapping) return null;

  const edition = await getFestivalEdition(mapping.edition_id);
  return {
    editionId: mapping.edition_id,
    festivalId:
      mapping.legacy_festival_id ?? edition?.festival_id ?? params.legacyId,
    legacySource: mapping.legacy_source,
    legacyId: mapping.legacy_id,
    isLegacyRoute: true,
    edition,
  };
}

export const legacyFestivalEditionQueryKey = (
  legacySource: FestivalLegacySource,
  legacyId: string,
) => ["festival-edition-resolution", legacySource, legacyId] as const;
