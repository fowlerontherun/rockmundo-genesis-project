import { describe, expect, it } from "vitest";
import { defaultFestivalBranding, festivalBrandingSchema, festivalThemes } from "./festivalBranding";

describe("edition branding compatibility", () => {
  it("keeps existing editions on their original colours", () => {
    expect(defaultFestivalBranding).toEqual({ theme: null, motif: "spotlight", version: 0 });
  });
  it("accepts every offered theme and rejects unsupported cosmetic keys", () => {
    for (const theme of festivalThemes) expect(festivalBrandingSchema.parse({ theme: theme.key, motif: "sunburst", version: 2 }).theme).toBe(theme.key);
    expect(festivalBrandingSchema.safeParse({ theme: "unknown", motif: "spotlight", version: 0 }).success).toBe(false);
    expect(festivalBrandingSchema.safeParse({ theme: "forest", motif: "unknown", version: 0 }).success).toBe(false);
  });
});