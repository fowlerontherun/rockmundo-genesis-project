import { describe, expect, it } from "vitest";
import { validateCookingCharacterClaim } from "../../../supabase/functions/cooking-session/requestContract";

const active = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

describe("JWT-verified cooking character request contract", () => {
  it("accepts only an explicit matching active character", () => {
    expect(validateCookingCharacterClaim(active, active)).toBeNull();
  });

  it.each([undefined, null, "", 12, {}, [], "not-a-uuid"])(
    "fails closed on missing or malformed profile ID %s",
    value => {
      expect(validateCookingCharacterClaim(value, active)).toBe("character_id_required");
    },
  );

  it("rejects another character's valid UUID even under the same user", () => {
    expect(validateCookingCharacterClaim(other, active)).toBe("active_character_mismatch");
  });

  it("does not silently pick a different profile after a character switch", () => {
    expect(validateCookingCharacterClaim(active, other)).toBe("active_character_mismatch");
    expect(validateCookingCharacterClaim(other, other)).toBeNull();
  });

  it("rejects UUID-prefix and case variants rather than matching loosely", () => {
    expect(validateCookingCharacterClaim(active + "-suffix", active)).toBe("character_id_required");
    expect(validateCookingCharacterClaim(active.toUpperCase(), active)).toBeNull();
  });
});
