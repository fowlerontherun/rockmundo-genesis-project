import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MaterialInventory } from "./MaterialInventory";
import type { CraftingMaterial, PlayerCraftingMaterial } from "@/hooks/useCraftingSystem";

const materials: CraftingMaterial[] = [
  { id: "t1", name: "Basswood Body Blank", category: "wood", rarity: "common", quality_tier: 1, base_cost: 80, description: "Tier one wood", image_url: null },
  { id: "t3", name: "Walnut Body Blank", category: "wood", rarity: "rare", quality_tier: 3, base_cost: 300, description: "Tier three wood", image_url: null },
  { id: "t5", name: "Titanium Hardware Set", category: "hardware", rarity: "legendary", quality_tier: 5, base_cost: 950, description: "Tier five hardware", image_url: null },
];

const stock: PlayerCraftingMaterial[] = [
  { id: "s1", profile_id: "profile", material_id: "t1", quantity: 2, acquired_at: "2026-10-06T00:00:00Z", material: materials[0] },
  { id: "s2", profile_id: "profile", material_id: "t5", quantity: 1, acquired_at: "2026-10-06T00:00:00Z", material: materials[2] },
];

describe("MaterialInventory tier filter", () => {
  it("filters the shop by quality tier and restores all materials", async () => {
    const user = userEvent.setup();
    render(
      <MaterialInventory
        materialsCatalog={materials}
        playerMaterials={stock}
        onPurchase={vi.fn()}
        isPurchasing={false}
        mode="shop"
      />,
    );

    expect(screen.getByText("Basswood Body Blank")).toBeInTheDocument();
    expect(screen.getByText("Walnut Body Blank")).toBeInTheDocument();
    expect(screen.getByText("Titanium Hardware Set")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tier 3" }));
    expect(screen.queryByText("Basswood Body Blank")).not.toBeInTheDocument();
    expect(screen.getByText("Walnut Body Blank")).toBeInTheDocument();
    expect(screen.queryByText("Titanium Hardware Set")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All tiers" }));
    expect(screen.getByText("Basswood Body Blank")).toBeInTheDocument();
    expect(screen.getByText("Titanium Hardware Set")).toBeInTheDocument();
  });

  it("filters owned inventory without exposing unowned materials", async () => {
    const user = userEvent.setup();
    render(
      <MaterialInventory
        materialsCatalog={materials}
        playerMaterials={stock}
        onPurchase={vi.fn()}
        isPurchasing={false}
        mode="inventory"
      />,
    );

    expect(screen.queryByText("Walnut Body Blank")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tier 5" }));
    expect(screen.getByText("Titanium Hardware Set")).toBeInTheDocument();
    expect(screen.queryByText("Basswood Body Blank")).not.toBeInTheDocument();
  });
});
