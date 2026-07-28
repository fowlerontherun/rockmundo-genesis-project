export const FESTIVAL_ROUTE_ERRORS = {
  company: "FESTIVAL_COMPANY_NOT_FOUND",
  edition: "FESTIVAL_EDITION_NOT_FOUND",
  legacy: "FESTIVAL_IDENTIFIER_LEGACY_ONLY",
  ambiguous: "FESTIVAL_IDENTIFIER_AMBIGUOUS",
  denied: "FESTIVAL_EDITION_ACCESS_DENIED",
} as const;

export type FestivalIdentifierKind =
  | "festival_company_id" | "legacy_festival_id" | "annual_edition_id"
  | "game_event_id" | "launch_id" | "runtime_session_id"
  | "participation_id" | "performance_session_id" | "festival_slug";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validates syntax only. Ownership/existence must be checked by the one named repository/RPC. */
export function validateFestivalRouteIdentifier(value: string | undefined, kind: FestivalIdentifierKind): string {
  const valid = kind === "festival_slug" ? Boolean(value && SLUG.test(value)) : Boolean(value && UUID.test(value));
  if (!valid) {
    if (kind === "festival_company_id") throw new Error(FESTIVAL_ROUTE_ERRORS.company);
    if (kind === "annual_edition_id") throw new Error(FESTIVAL_ROUTE_ERRORS.edition);
    throw new Error(FESTIVAL_ROUTE_ERRORS.ambiguous);
  }
  return value!;
}
