// Preview-only catalogue. Live recipe unlocks, ingredient ownership and cooking rewards
// must be provided by authoritative game services before production crafting is enabled.
export type RecipeCategory = "Soups & stews" | "Pies & baking" | "Drinks" | "Meals";
export interface CookingRecipe {
  slug: string;
  name: string;
  category: RecipeCategory;
  region: string;
  ingredients: readonly string[];
  portions: number;
  shelfLifeHours: number;
  buff: string;
  buffHours: number;
  method: "pan" | "oven" | "simmer" | "mix";
}
export const COOKING_RECIPES: readonly CookingRecipe[] = [
  { slug: "vegetable-soup", name: "Vegetable soup", category: "Soups & stews", region: "United Kingdom", ingredients: ["Carrot", "Onion", "Potato", "Vegetable stock"], portions: 3, shelfLifeHours: 48, buff: "+5% recovery from resting", buffHours: 3, method: "simmer" },
  { slug: "onion-soup", name: "Onion soup", category: "Soups & stews", region: "France", ingredients: ["Onion", "Vegetable stock", "Butter"], portions: 2, shelfLifeHours: 48, buff: "+5% recovery from resting", buffHours: 3, method: "simmer" },
  { slug: "tomato-soup", name: "Tomato soup", category: "Soups & stews", region: "Italy", ingredients: ["Tomato", "Basil", "Vegetable stock"], portions: 3, shelfLifeHours: 48, buff: "+5% recovery from resting", buffHours: 3, method: "simmer" },
  { slug: "lentil-stew", name: "Spiced lentil stew", category: "Soups & stews", region: "India", ingredients: ["Lentils", "Spices", "Onion"], portions: 3, shelfLifeHours: 48, buff: "+5% practice XP", buffHours: 3, method: "simmer" },
  { slug: "apple-pie", name: "Apple pie", category: "Pies & baking", region: "United Kingdom", ingredients: ["Apples", "Flour", "Butter", "Sugar"], portions: 6, shelfLifeHours: 72, buff: "+5% rehearsal effectiveness", buffHours: 3, method: "oven" },
  { slug: "fruit-tart", name: "Fruit tart", category: "Pies & baking", region: "France", ingredients: ["Orchard fruit", "Flour", "Butter"], portions: 4, shelfLifeHours: 48, buff: "+5% songwriting polish gain", buffHours: 2, method: "oven" },
  { slug: "citrus-cake", name: "Citrus cake", category: "Pies & baking", region: "Italy", ingredients: ["Citrus", "Flour", "Eggs", "Sugar"], portions: 6, shelfLifeHours: 72, buff: "+5% songwriting polish gain", buffHours: 2, method: "oven" },
  { slug: "tea-cakes", name: "Tea cakes", category: "Pies & baking", region: "Japan", ingredients: ["Rice flour", "Tea", "Sugar"], portions: 4, shelfLifeHours: 48, buff: "+5% songwriting polish gain", buffHours: 2, method: "oven" },
  { slug: "rice-bowl", name: "Mushroom rice bowl", category: "Meals", region: "Japan", ingredients: ["Rice", "Mushrooms", "Soy seasoning"], portions: 2, shelfLifeHours: 48, buff: "+5% rehearsal effectiveness", buffHours: 3, method: "pan" },
  { slug: "bean-stew", name: "Bean and pepper stew", category: "Meals", region: "Mexico", ingredients: ["Beans", "Peppers", "Maize"], portions: 3, shelfLifeHours: 48, buff: "+5% practice XP", buffHours: 3, method: "simmer" },
  { slug: "spiced-tea", name: "Spiced tea", category: "Drinks", region: "India", ingredients: ["Tea", "Spices", "Milk"], portions: 2, shelfLifeHours: 24, buff: "+5% focus on practice", buffHours: 2, method: "mix" },
  { slug: "fruit-drink", name: "Tropical fruit drink", category: "Drinks", region: "Brazil", ingredients: ["Tropical fruit", "Water", "Sugar"], portions: 2, shelfLifeHours: 24, buff: "+5% recovery from resting", buffHours: 2, method: "mix" },
] as const;

export const getCookingRecipes = (category: RecipeCategory | "All" = "All") =>
  COOKING_RECIPES.filter((recipe) => category === "All" || recipe.category === category);
