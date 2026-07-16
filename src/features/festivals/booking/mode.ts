import { getPublicFestivalEdition, resolveEditionFromLegacyIdentifier } from '@/features/festivals/service';
import type { FestivalEdition, FestivalLegacySource } from '@/features/festivals/types';

export type FestivalBookingMode = 'canonical' | 'legacy' | 'unavailable';

export interface ResolvedFestivalEdition {
  festivalBrandId: string | null;
  editionId: string | null;
  edition: FestivalEdition | null;
  resolvedFromLegacy: boolean;
  canonicalBookingAvailable: boolean;
  mode: FestivalBookingMode;
  legacySource?: FestivalLegacySource;
  legacyId?: string;
}

export function getFestivalBookingMode(input: { editionId?: string | null; legacyId?: string | null; canonicalBookingAvailable?: boolean }): FestivalBookingMode {
  if (input.editionId && input.canonicalBookingAvailable !== false) return 'canonical';
  if (input.legacyId) return 'legacy';
  return 'unavailable';
}

export function warnIfCanonicalUsesLegacyMutation(context: string, editionId?: string | null) {
  if (import.meta.env.DEV && editionId) {
    // eslint-disable-next-line no-console
    console.warn(`[festivals:booking] Canonical edition ${editionId} reached legacy mutation: ${context}`);
  }
}

export async function resolveFestivalEditionIdentifier(params: { identifier?: string | null; legacySource?: FestivalLegacySource }): Promise<ResolvedFestivalEdition> {
  const identifier = params.identifier;
  if (!identifier) {
    return { festivalBrandId: null, editionId: null, edition: null, resolvedFromLegacy: false, canonicalBookingAvailable: false, mode: 'unavailable' };
  }

  const directEdition = await getPublicFestivalEdition(identifier);
  if (directEdition) {
    return {
      festivalBrandId: directEdition.festival_id,
      editionId: directEdition.id,
      edition: directEdition,
      resolvedFromLegacy: false,
      canonicalBookingAvailable: true,
      mode: 'canonical',
    };
  }

  const mapping = await resolveEditionFromLegacyIdentifier(params.legacySource ?? 'dedicated_festival_row', identifier);
  if (!mapping?.edition_id) {
    if (import.meta.env.DEV) console.warn(`[festivals:booking] Unresolved festival identifier: ${identifier}`);
    return { festivalBrandId: identifier, editionId: null, edition: null, resolvedFromLegacy: false, canonicalBookingAvailable: false, mode: 'legacy', legacyId: identifier, legacySource: params.legacySource ?? 'dedicated_festival_row' };
  }

  const edition = await getPublicFestivalEdition(mapping.edition_id);
  return {
    festivalBrandId: mapping.legacy_festival_id ?? edition?.festival_id ?? null,
    editionId: mapping.edition_id,
    edition,
    resolvedFromLegacy: true,
    canonicalBookingAvailable: Boolean(edition),
    mode: getFestivalBookingMode({ editionId: mapping.edition_id, legacyId: identifier, canonicalBookingAvailable: Boolean(edition) }),
    legacyId: identifier,
    legacySource: mapping.legacy_source,
  };
}
