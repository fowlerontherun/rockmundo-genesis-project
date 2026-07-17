import type { FestivalCreationDraft } from "../../types";

type MaterialFestivalCreationDraft = Omit<FestivalCreationDraft, "idempotencyKey">;

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : value;

function normalizeDraft(draft: FestivalCreationDraft): MaterialFestivalCreationDraft {
  return {
    mode: draft.mode,
    existingFestivalId: draft.existingFestivalId ?? undefined,
    identity: {
      ...draft.identity,
      name: String(normalizeString(draft.identity.name)),
      shortDescription: String(normalizeString(draft.identity.shortDescription)),
      fullDescription: String(normalizeString(draft.identity.fullDescription)),
      imageUrl: draft.identity.imageUrl?.trim() || "",
      primaryGenres: [...draft.identity.primaryGenres].sort(),
    },
    edition: { ...draft.edition, title: draft.edition.title.trim() },
    location: {
      ...draft.location,
      cityName: draft.location.cityName?.trim() || "",
      venueId: draft.location.venueId || "",
      siteName: draft.location.siteName?.trim() || "",
    },
    stages: draft.stages.map((stage) => ({
      ...stage,
      name: stage.name.trim(),
      type: stage.type.trim(),
      curfew: stage.curfew.trim(),
      weatherProtection: stage.weatherProtection.trim(),
      soundCapability: stage.soundCapability.trim(),
      lightingCapability: stage.lightingCapability.trim(),
    })),
    commercial: { ...draft.commercial },
  };
}

export function isFestivalCreationDraftDirty(
  initialDraft: FestivalCreationDraft,
  currentDraft: FestivalCreationDraft,
): boolean {
  return JSON.stringify(normalizeDraft(initialDraft)) !== JSON.stringify(normalizeDraft(currentDraft));
}
