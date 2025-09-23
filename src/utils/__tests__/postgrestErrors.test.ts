import { describe, expect, it } from "bun:test";

import { isTableMissingFromSchemaCache } from "../postgrestErrors";

describe("isTableMissingFromSchemaCache", () => {
  it("returns true for Postgres undefined table error codes", () => {
    expect(isTableMissingFromSchemaCache({ code: "42P01" })).toBe(true);
  });

  it("returns true for PostgREST schema cache table errors", () => {
    expect(
      isTableMissingFromSchemaCache({
        code: "PGRST301",
        message: "Could not find the table 'public.travel_flights' in the schema cache",
      }),
    ).toBe(true);
  });

  it("detects table cache errors via message text when code is missing", () => {
    expect(
      isTableMissingFromSchemaCache({
        message: "Could not find the table 'public.travel_flights' in the schema cache",
      }),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(
      isTableMissingFromSchemaCache({
        code: "PGRST205",
        message: "Could not find foreign key in schema cache",
      }),
    ).toBe(false);

    expect(isTableMissingFromSchemaCache(null)).toBe(false);
    expect(isTableMissingFromSchemaCache({ message: "Random failure" })).toBe(false);
  });
});
