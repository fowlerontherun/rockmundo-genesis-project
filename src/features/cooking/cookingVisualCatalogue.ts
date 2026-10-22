/** Shared visual catalogue: presentation data only, never an inventory or recipe authority. */
export type IngredientForm = "fruit" | "root" | "leaf" | "grain" | "mushroom" |
  "bottle" | "egg" | "dairy" | "bean" | "powder" | "liquid" | "pepper";

export interface IngredientVisual {
  form: IngredientForm;
  color: string;
  accent: string;
}

const LOOKS: Record<string, IngredientVisual> = {
  apples: { form: "fruit", color: "#d75b49", accent: "#e4ba65" },
  basil: { form: "leaf", color: "#56976b", accent: "#c2cf76" },
  beans: { form: "bean", color: "#ae6854", accent: "#e3b780" },
  butter: { form: "dairy", color: "#f1d781", accent: "#f8e7b2" },
  carrot: { form: "root", color: "#eb9044", accent: "#86ad66" },
  citrus: { form: "fruit", color: "#f6c34e", accent: "#e9944d" },
  eggs: { form: "egg", color: "#f9e5bd", accent: "#e4b66c" },
  flour: { form: "powder", color: "#f1e4c9", accent: "#c9ab87" },
  lentils: { form: "bean", color: "#ad8a50", accent: "#d9bc76" },
  maize: { form: "grain", color: "#e9b64a", accent: "#9aaf68" },
  milk: { form: "dairy", color: "#f3f2df", accent: "#c7d8de" },
  mushrooms: { form: "mushroom", color: "#c7a17b", accent: "#92715b" },
  onion: { form: "root", color: "#dec59b", accent: "#a9b876" },
  "orchard-fruit": { form: "fruit", color: "#d77758", accent: "#e7c36f" },
  peppers: { form: "pepper", color: "#d95b45", accent: "#67a269" },
  potato: { form: "root", color: "#c9a779", accent: "#94b070" },
  rice: { form: "grain", color: "#f3e8ce", accent: "#d7bd82" },
  "rice-flour": { form: "powder", color: "#eee2cf", accent: "#b3a085" },
  "soy-seasoning": { form: "bottle", color: "#7b4831", accent: "#d8a45e" },
  spices: { form: "powder", color: "#cc7841", accent: "#e5ad57" },
  sugar: { form: "powder", color: "#f7e9d7", accent: "#d3b9a2" },
  tea: { form: "leaf", color: "#538b62", accent: "#a7ad61" },
  tomato: { form: "fruit", color: "#d75743", accent: "#99a66a" },
  "tropical-fruit": { form: "fruit", color: "#e8ae48", accent: "#bb5f7c" },
  "vegetable-stock": { form: "liquid", color: "#c6a36c", accent: "#d3cf9d" },
  water: { form: "liquid", color: "#8abbd4", accent: "#d2e7e9" },
};
export function ingredientVisual(slug: string): IngredientVisual {
  const normalized = slug.toLowerCase().trim().replace(/\s+/g, "-");
  return LOOKS[normalized] ?? {
    form: "powder", color: "#d8bda0", accent: "#e9d9bd",
  };
}
export const ILLUSTRATED_INGREDIENTS = Object.keys(LOOKS);

export type DishShape = "pie" | "cake" | "soup" | "stew" | "drink" | "bowl";
export function dishShape(slug: string): DishShape {
  if (/pie|tart/.test(slug)) return "pie";
  if (/cake/.test(slug)) return "cake";
  if (/soup/.test(slug)) return "soup";
  if (/stew/.test(slug)) return "stew";
  if (/tea|drink/.test(slug)) return "drink";
  return "bowl";
}

export type FoodVisualStage = "Raw" | "Warming" | "Cooking" | "Ready" |
  "Overdone" | "Burnt" | "Unmixed" | "Mixing";
export function dishSurfaceColor(stage: FoodVisualStage): string {
  if (stage === "Burnt") return "#3b302e";
  if (stage === "Overdone") return "#945c33";
  if (stage === "Ready") return "#dca05b";
  if (stage === "Warming" || stage === "Cooking" || stage === "Mixing") return "#ddb975";
  return "#efce9c";
}
