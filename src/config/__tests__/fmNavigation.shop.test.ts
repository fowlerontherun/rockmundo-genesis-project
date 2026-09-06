import { describe, expect, it } from "vitest";
import { resolveModuleForPath } from "../fmNavigation";

describe("shop route ownership", () => {
  it.each(["/subscription", "/subscription-status"])("assigns %s to the Shop module", (path) => {
    expect(resolveModuleForPath(path)?.id).toBe("shop");
  });
});
