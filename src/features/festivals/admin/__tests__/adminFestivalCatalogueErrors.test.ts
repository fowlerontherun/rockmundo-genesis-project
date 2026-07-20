import { describe, expect, it } from "vitest";
import { FestivalAdminServiceError, mapFestivalError } from "../service";

describe("admin festival catalogue error mapping", () => {
  it("maps missing RPC errors separately from permissions", () => {
    const error = mapFestivalError(
      { code: "PGRST202", message: "Could not find the function public.admin_festival_catalogue" },
      "admin_festival_catalogue",
    );

    expect(error).toBeInstanceOf(FestivalAdminServiceError);
    expect(error.code).toBe("FESTIVAL_RPC_NOT_DEPLOYED");
  });

  it("maps relation and column failures to migration mismatch", () => {
    expect(mapFestivalError({ code: "42P01", message: "relation does not exist" }).code).toBe("FESTIVAL_SCHEMA_MISMATCH");
    expect(mapFestivalError({ code: "42703", message: "column does not exist" }).code).toBe("FESTIVAL_SCHEMA_MISMATCH");
  });

  it("preserves real authorization failures", () => {
    expect(mapFestivalError({ code: "42501", message: "permission denied" }).code).toBe("FESTIVAL_PERMISSION_DENIED");
  });
});
