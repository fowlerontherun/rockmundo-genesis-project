export type GarmentTemplateKey =
  | "tshirt"
  | "long-sleeve"
  | "shirt"
  | "hoodie"
  | "jacket"
  | "coat"
  | "vest"
  | "dress"
  | "skirt"
  | "trousers"
  | "jeans"
  | "shorts"
  | "trainers"
  | "boots"
  | "dress-shoes"
  | "cap"
  | "beanie"
  | "wide-brim-hat"
  | "round-glasses"
  | "square-glasses"
  | "aviators";

export interface GarmentTemplateDefinition {
  key: GarmentTemplateKey;
  label: string;
  slot: "top" | "bottom" | "footwear" | "headwear" | "eyewear";
  surfaces: Array<"front" | "back" | "left-sleeve" | "right-sleeve">;
}

export const GARMENT_TEMPLATES: GarmentTemplateDefinition[] = [
  { key: "tshirt", label: "T-shirt", slot: "top", surfaces: ["front", "back", "left-sleeve", "right-sleeve"] },
  { key: "long-sleeve", label: "Long sleeve top", slot: "top", surfaces: ["front", "back", "left-sleeve", "right-sleeve"] },
  { key: "shirt", label: "Shirt", slot: "top", surfaces: ["front", "back", "left-sleeve", "right-sleeve"] },
  { key: "hoodie", label: "Hoodie", slot: "top", surfaces: ["front", "back", "left-sleeve", "right-sleeve"] },
  { key: "jacket", label: "Jacket", slot: "top", surfaces: ["front", "back", "left-sleeve", "right-sleeve"] },
  { key: "coat", label: "Coat", slot: "top", surfaces: ["front", "back", "left-sleeve", "right-sleeve"] },
  { key: "vest", label: "Vest", slot: "top", surfaces: ["front", "back"] },
  { key: "dress", label: "Dress", slot: "top", surfaces: ["front", "back", "left-sleeve", "right-sleeve"] },
  { key: "skirt", label: "Skirt", slot: "bottom", surfaces: ["front", "back"] },
  { key: "trousers", label: "Trousers", slot: "bottom", surfaces: ["front", "back"] },
  { key: "jeans", label: "Jeans", slot: "bottom", surfaces: ["front", "back"] },
  { key: "shorts", label: "Shorts", slot: "bottom", surfaces: ["front", "back"] },
  { key: "trainers", label: "Trainers", slot: "footwear", surfaces: ["front"] },
  { key: "boots", label: "Boots", slot: "footwear", surfaces: ["front"] },
  { key: "dress-shoes", label: "Dress shoes", slot: "footwear", surfaces: ["front"] },
  { key: "cap", label: "Cap", slot: "headwear", surfaces: ["front", "back"] },
  { key: "beanie", label: "Beanie", slot: "headwear", surfaces: ["front", "back"] },
  { key: "wide-brim-hat", label: "Wide brim hat", slot: "headwear", surfaces: ["front", "back"] },
  { key: "round-glasses", label: "Round glasses", slot: "eyewear", surfaces: ["front"] },
  { key: "square-glasses", label: "Square glasses", slot: "eyewear", surfaces: ["front"] },
  { key: "aviators", label: "Aviators", slot: "eyewear", surfaces: ["front"] },
];

export function inferGarmentTemplateKey(category?: string | null, name?: string | null): GarmentTemplateKey {
  const text = `${category || ""} ${name || ""}`.toLowerCase();
  if (/aviator/.test(text)) return "aviators";
  if (/square|wayfarer/.test(text)) return "square-glasses";
  if (/glass/.test(text)) return "round-glasses";
  if (/beanie/.test(text)) return "beanie";
  if (/fedora|wide|cowboy|sun hat/.test(text)) return "wide-brim-hat";
  if (/hat|cap/.test(text)) return "cap";
  if (/boot/.test(text)) return "boots";
  if (/trainer|sneaker/.test(text)) return "trainers";
  if (/shoe/.test(text)) return "dress-shoes";
  if (/short/.test(text)) return "shorts";
  if (/jean/.test(text)) return "jeans";
  if (/pants|trouser/.test(text)) return "trousers";
  if (/skirt/.test(text)) return "skirt";
  if (/dress/.test(text)) return "dress";
  if (/coat/.test(text)) return "coat";
  if (/jacket/.test(text)) return "jacket";
  if (/hood/.test(text)) return "hoodie";
  if (/vest/.test(text)) return "vest";
  if (/long.?sleeve/.test(text)) return "long-sleeve";
  if (/shirt/.test(text) && !/t-?shirt/.test(text)) return "shirt";
  return "tshirt";
}

export function garmentTemplate(key?: string | null) {
  return GARMENT_TEMPLATES.find(template => template.key === key);
}
