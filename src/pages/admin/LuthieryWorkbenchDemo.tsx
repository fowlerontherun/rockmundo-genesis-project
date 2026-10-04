import { LuthieryWorkbench } from "@/components/crafting/LuthieryWorkbench";
import { CRAFTING_MATERIALS } from "@/data/craftingMaterials";
import { SkillSystemContext } from "@/hooks/SkillSystemContext";
import type { SkillProgressRecord, SkillSystemContextValue } from "@/hooks/useSkillSystem.types";
import type { CraftingMaterial, PlayerCraftingMaterial } from "@/hooks/useCraftingSystem";

const materialsCatalog: CraftingMaterial[] = CRAFTING_MATERIALS.map((material, index) => ({
  id: `fixture-material-${index}`,
  name: material.name,
  category: material.category,
  rarity: material.rarity,
  quality_tier: material.quality_tier,
  base_cost: material.base_cost,
  description: material.description,
  image_url: null,
}));

const playerMaterials: PlayerCraftingMaterial[] = materialsCatalog.map((material, index) => ({
  id: `fixture-stock-${index}`,
  profile_id: "luthiery-fixture-profile",
  material_id: material.id,
  quantity: 12,
  acquired_at: "2026-10-04T00:00:00.000Z",
  material,
}));

const progress: SkillProgressRecord[] = [
  {
    id: "fixture-basic",
    profile_id: "luthiery-fixture-profile",
    skill_slug: "luthiery_basic_technical",
    current_level: 250,
    current_xp: 0,
    required_xp: 100,
  },
  {
    id: "fixture-professional",
    profile_id: "luthiery-fixture-profile",
    skill_slug: "luthiery_professional_technical",
    current_level: 650,
    current_xp: 0,
    required_xp: 100,
  },
  {
    id: "fixture-mastery",
    profile_id: "luthiery-fixture-profile",
    skill_slug: "luthiery_mastery_technical",
    current_level: 650,
    current_xp: 0,
    required_xp: 100,
  },
];

const contextValue: SkillSystemContextValue = {
  definitions: [],
  relationships: [],
  progress,
  loading: false,
  error: null,
  refreshProgress: async () => undefined,
  updateSkillProgress: async () => null,
};

const LuthieryWorkbenchDemo = () => (
  <main className="container mx-auto space-y-4 p-4">
    <div>
      <h1 className="text-3xl font-bold">Luthiery Workbench Demo</h1>
      <p className="text-sm text-muted-foreground">
        Demo data only — all skills and materials are locally supplied and no game records can be changed.
      </p>
    </div>
    <SkillSystemContext.Provider value={contextValue}>
      <LuthieryWorkbench materialsCatalog={materialsCatalog} playerMaterials={playerMaterials} />
    </SkillSystemContext.Provider>
  </main>
);

export default LuthieryWorkbenchDemo;
