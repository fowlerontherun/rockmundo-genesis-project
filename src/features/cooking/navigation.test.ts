import { describe, expect, it } from "vitest";
import { FM_MODULES, findModuleForPath } from "@/config/fmNavigation";

describe("cooking navigation", () => {
  it("resolves cooking to Career and exposes its sidebar entry", () => {
    expect(findModuleForPath("/cooking").id).toBe("career");
    const career = FM_MODULES.find(({ id }) => id === "career")!;
    expect(career.sidebar.flatMap(({ items }) => items)).toContainEqual(
      expect.objectContaining({ label: "Cooking", path: "/cooking" }),
    );
  });
});
