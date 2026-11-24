import { z } from "zod";

export const festivalThemes = [
  { key: "electric", name: "Electric Neon", mood: "After-dark energy" },
  { key: "vintage", name: "Vintage Woodstock", mood: "Peace, music & discovery" },
  { key: "indie", name: "British Indie", mood: "Bold, independent spirit" },
  { key: "industrial", name: "Industrial Rust", mood: "Raw, heavy & loud" },
  { key: "sunset", name: "Psych Sunset", mood: "Colourful, cosmic sounds" },
  { key: "forest", name: "Forest Folk", mood: "Nature & acoustic roots" },
] as const;
export const festivalMotifs = ["spotlight", "stripes", "sunburst"] as const;
export const festivalBrandingSchema = z.object({
  theme: z.enum(["electric", "vintage", "indie", "industrial", "sunset", "forest"]).nullable(),
  motif: z.enum(festivalMotifs),
  version: z.number().int().nonnegative(),
});
export type FestivalBranding = z.infer<typeof festivalBrandingSchema>;
export const defaultFestivalBranding: FestivalBranding = { theme: null, motif: "spotlight", version: 0 };
export const festivalBrandingKey = (editionId?: string | null) => ["festival-branding", editionId] as const;