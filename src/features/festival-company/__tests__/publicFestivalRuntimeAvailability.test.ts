import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

import { mapFestivalRuntimeError } from "../data/festivalRuntimeRepository";

describe("public festival runtime availability", () => {
  it("marks undeployed live-status RPC as unavailable without hiding the reason", () => {
    const err = mapFestivalRuntimeError(
      "Could not find the function public.get_public_festival_live_status(p_public_slug) in the schema cache",
      "PGRST202",
    );
    expect(err.message).toBe("festival_public_runtime_not_deployed");
  });

  it("marks undeployed live-experience RPC as unavailable", () => {
    const err = mapFestivalRuntimeError(
      "Could not find the function public.get_public_festival_live_experience(p_public_slug) in the schema cache",
    );
    expect(err.message).toBe("festival_public_runtime_not_deployed");
  });

  it("does not misclassify other missing functions as festival public runtime", () => {
    const err = mapFestivalRuntimeError(
      "Could not find the function public.get_festival_edition_runtime_control_room",
      "PGRST202",
    );
    expect(err.message).not.toBe("festival_public_runtime_not_deployed");
  });

  it("preserves existing stale and forbidden error mapping", () => {
    expect(mapFestivalRuntimeError("festival_runtime_stale").message).toBe("festival_runtime_stale");
    expect(mapFestivalRuntimeError("festival_runtime_forbidden").message).toBe("festival_runtime_forbidden");
  });
});
