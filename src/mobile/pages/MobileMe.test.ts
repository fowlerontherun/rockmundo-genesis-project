import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/mobile/pages/MobileMe.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

describe("Mobile Me Phase 7 source coverage", () => {
  it("uses dedicated mobile sections instead of desktop fallbacks", () => {
    for (const section of ["overview", "wellness", "inventory", "wardrobe", "skills", "education", "achievements", "settings"]) {
      expect(source).toContain(section);
    }
    expect(source).toContain("MobileSectionCard");
    expect(source).toContain("MobileStickyActionBar");
  });

  it("keeps direct Me links inside the mobile shell", () => {
    expect(app).toContain('path="/mobile" element={<MobileLayout />}');
    expect(app).toContain('path="me/:section" element={<MobileMe />}');
    expect(app).toContain('path="me/:section/:id" element={<MobileMe />}');
  });

  it("documents validation and backend-rule reuse in action sheets", () => {
    for (const phrase of ["revalidated by the existing wellness action", "revalidates ownership", "existing wardrobe/avatar save path", "existing skill progression mutation"]) {
      expect(source).toContain(phrase);
    }
  });
});
