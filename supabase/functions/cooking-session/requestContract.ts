/**
 * Fail-closed cooking character contract.
 *
 * The API resolves the active character using a freshly verified JWT and
 * an authenticated, user-scoped profiles query. A caller's supplied profile
 * ID is only a claim to compare against that server-selected identity; it
 * must never independently authorize service-role RPC calls.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CookingCharacterError = "character_id_required" | "active_character_mismatch";

export function validateCookingCharacterClaim(
  requestedProfileId: unknown,
  serverActiveProfileId: string,
): CookingCharacterError | null {
  if (typeof requestedProfileId !== "string" || !UUID_PATTERN.test(requestedProfileId)) {
    return "character_id_required";
  }
  if (requestedProfileId !== serverActiveProfileId) {
    return "active_character_mismatch";
  }
  return null;
}
