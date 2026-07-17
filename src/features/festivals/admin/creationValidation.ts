import type {
  FestivalCreationDraft,
  FestivalCreationValidationErrors,
  FestivalStageCreationInput,
} from "./types";

export const FESTIVAL_TYPE_OPTIONS = [
  "national",
  "city",
  "community",
  "genre",
  "showcase",
  "charity",
] as const;
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export const SUPPORTED_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
] as const;

export function moneyToCents(value: string | number) {
  return Math.round(Number(value || 0) * 100);
}
export function centsToMoney(value: number) {
  return (value / 100).toFixed(2);
}

export function stagePreset(
  preset: "small" | "medium" | "large",
  capacity: number,
): FestivalStageCreationInput[] {
  const base = (name: string, ratio: number): FestivalStageCreationInput => ({
    name,
    type: name === "Main Stage" ? "main" : "secondary",
    capacity: Math.max(1, Math.floor(capacity * ratio)),
    changeoverMinutes: 30,
    curfew: "23:00",
    weatherProtection: "covered",
    soundCapability: "standard_pa",
    lightingCapability: "standard_lighting",
  });
  if (preset === "small") return [base("Main Stage", 1)];
  if (preset === "medium")
    return [base("Main Stage", 0.7), base("Second Stage", 0.45)];
  return [
    base("Main Stage", 0.7),
    base("Second Stage", 0.45),
    base("New Music Stage", 0.25),
  ];
}

export function defaultFestivalCreationDraft(
  mode: FestivalCreationDraft["mode"] = "create_festival",
  existingFestivalId?: string,
): FestivalCreationDraft {
  const now = new Date();
  const start = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);
  const end = new Date(start.getTime() + 1000 * 60 * 60 * 8);
  const appOpen = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);
  const appClose = new Date(start.getTime() - 1000 * 60 * 60 * 24 * 14);
  const capacity = 1000;
  return {
    mode,
    existingFestivalId,
    idempotencyKey: crypto.randomUUID(),
    identity: {
      name: "",
      shortDescription: "",
      fullDescription: "",
      festivalType: "city",
      primaryGenres: [],
      imageUrl: "",
      isPublic: false,
    },
    edition: {
      title: "",
      editionNumber: mode === "add_edition" ? 2 : 1,
      startAt: toLocalInput(start),
      endAt: toLocalInput(end),
      applicationsOpenAt: toLocalInput(appOpen),
      applicationsCloseAt: toLocalInput(appClose),
      bookingDeadlineAt: toLocalInput(appClose),
      timezone: "UTC",
      currencyCode: "USD",
    },
    location: {
      country: "",
      cityId: "",
      cityName: "",
      venueId: "",
      siteName: "",
      capacity,
      minTicketPriceCents: 2500,
      maxTicketPriceCents: 12500,
      defaultTicketPriceCents: 5000,
      festivalDays: 1,
    },
    stages: stagePreset("small", capacity),
    commercial: {
      estimatedAttendance: 750,
      operatingBudgetCents: 1000000,
      performerBudgetCents: 500000,
      staffingBudgetCents: 200000,
      marketingBudgetCents: 150000,
      sponsorshipEnabled: true,
      merchandiseEnabled: true,
      concessionsEnabled: true,
    },
  };
}

export function toLocalInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function buildEditionTitle(name: string, startAt: string) {
  const year = startAt
    ? new Date(startAt).getFullYear()
    : new Date().getFullYear();
  return `${name.trim() || "Festival"} ${year}`;
}

export function validateFestivalCreationDraft(
  draft: FestivalCreationDraft,
  current = new Date(),
): FestivalCreationValidationErrors {
  const errors: FestivalCreationValidationErrors = {};
  if (draft.mode === "create_festival") {
    const identity: string[] = [];
    if (!draft.identity.name.trim())
      identity.push("Festival name is required.");
    if (draft.identity.name.trim().length > 120)
      identity.push("Festival name must be 120 characters or fewer.");
    if (!draft.identity.shortDescription.trim())
      identity.push("Short description is required.");
    if (!draft.identity.fullDescription.trim())
      identity.push("Full description is required.");
    if (!draft.identity.primaryGenres.length)
      identity.push("Select at least one primary genre.");
    if (identity.length) errors.identity = identity;
  }
  const edition: string[] = [];
  const start = new Date(draft.edition.startAt);
  const end = new Date(draft.edition.endAt);
  const appOpen = new Date(draft.edition.applicationsOpenAt);
  const appClose = new Date(draft.edition.applicationsCloseAt);
  if (!draft.edition.title.trim()) edition.push("Edition title is required.");
  if (draft.edition.editionNumber < 1)
    edition.push("Edition number must be positive.");
  if (!(end > start)) edition.push("End must be after start.");
  if (start < current) edition.push("Dates in the past are not allowed.");
  if (appClose < appOpen)
    edition.push("Applications cannot close before they open.");
  if (!(appClose < start))
    edition.push("Applications must close before the festival begins.");
  if (!SUPPORTED_CURRENCIES.includes(draft.edition.currencyCode as never))
    edition.push("Currency is not supported.");
  if (!SUPPORTED_TIMEZONES.includes(draft.edition.timezone as never))
    edition.push("Time zone is not supported.");
  if (edition.length) errors.edition = edition;
  const location: string[] = [];
  if (!draft.location.cityId) location.push("Select a city.");
  if (draft.location.capacity <= 0)
    location.push("Capacity must be greater than zero.");
  if (draft.location.minTicketPriceCents > draft.location.maxTicketPriceCents)
    location.push("Minimum ticket price cannot exceed maximum ticket price.");
  if (
    draft.location.defaultTicketPriceCents <
      draft.location.minTicketPriceCents ||
    draft.location.defaultTicketPriceCents > draft.location.maxTicketPriceCents
  )
    location.push("Default ticket price must be within the configured range.");
  if (location.length) errors.location = location;
  const stages: string[] = [];
  if (draft.stages.length === 0) stages.push("At least one stage is required.");
  const names = new Set<string>();
  draft.stages.forEach((stage) => {
    const key = stage.name.trim().toLowerCase();
    if (!key) stages.push("Stage names are required.");
    if (names.has(key))
      stages.push("Stage names must be unique within the event.");
    names.add(key);
    if (stage.capacity <= 0)
      stages.push(`${stage.name || "Stage"} capacity must be positive.`);
    if (stage.capacity > draft.location.capacity)
      stages.push(
        `${stage.name || "Stage"} capacity cannot exceed overall capacity.`,
      );
    if (stage.changeoverMinutes < 5)
      stages.push(
        `${stage.name || "Stage"} changeover must be at least five minutes.`,
      );
    if (!/^\d{2}:\d{2}$/.test(stage.curfew))
      stages.push(`${stage.name || "Stage"} curfew must be a valid time.`);
  });
  if (stages.length) errors.stages = Array.from(new Set(stages));
  return errors;
}
export function hasCreationErrors(errors: FestivalCreationValidationErrors) {
  return Object.values(errors).some((list) => list && list.length > 0);
}
