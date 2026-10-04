import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LuthieryWorkbench } from "./LuthieryWorkbench";
import type { CraftingMaterial, PlayerCraftingMaterial } from "@/hooks/useCraftingSystem";

const progress = [
  { id: "basic", profile_id: "profile", skill_slug: "luthiery_basic_technical", current_level: 20, current_xp: 0, required_xp: 100 },
  { id: "professional", profile_id: "profile", skill_slug: "luthiery_professional_technical", current_level: 20, current_xp: 0, required_xp: 100 },
  { id: "mastery", profile_id: "profile", skill_slug: "luthiery_mastery_technical", current_level: 20, current_xp: 0, required_xp: 100 },
];

vi.mock("@/hooks/useSkillSystem", () => ({
  useSkillSystem: () => ({
    definitions: [],
    relationships: [],
    progress,
    loading: false,
    error: null,
    refreshProgress: vi.fn(),
    updateSkillProgress: vi.fn(),
  }),
}));

const material = (id: string, name: string, tier = 2): CraftingMaterial => ({
  id,
  name,
  category: "test",
  rarity: tier >= 4 ? "epic" : tier >= 3 ? "rare" : tier >= 2 ? "uncommon" : "common",
  quality_tier: tier,
  base_cost: tier * 100,
  description: null,
  image_url: null,
});

const materials: CraftingMaterial[] = [
  material("alder", "Alder Body Blank", 2),
  material("maple", "Maple Neck Blank", 2),
  material("single", "Single Coil Pickup", 1),
  material("standard", "Standard Tuners Set", 1),
  material("satin", "Satin Lacquer", 1),
  material("art", "Custom Artwork Finish", 4),
  material("boutique", "Hand-Wound Boutique Pickup", 4),
];

const stock: PlayerCraftingMaterial[] = [
  { id: "s1", profile_id: "profile", material_id: "alder", quantity: 2, acquired_at: "2026-10-04T00:00:00Z", material: materials[0] },
  { id: "s2", profile_id: "profile", material_id: "maple", quantity: 3, acquired_at: "2026-10-04T00:00:00Z", material: materials[1] },
  { id: "s3", profile_id: "profile", material_id: "single", quantity: 2, acquired_at: "2026-10-04T00:00:00Z", material: materials[2] },
  { id: "s4", profile_id: "profile", material_id: "standard", quantity: 2, acquired_at: "2026-10-04T00:00:00Z", material: materials[3] },
  { id: "s5", profile_id: "profile", material_id: "satin", quantity: 2, acquired_at: "2026-10-04T00:00:00Z", material: materials[4] },
  { id: "s6", profile_id: "profile", material_id: "art", quantity: 2, acquired_at: "2026-10-04T00:00:00Z", material: materials[5] },
  { id: "s7", profile_id: "profile", material_id: "boutique", quantity: 2, acquired_at: "2026-10-04T00:00:00Z", material: materials[6] },
];

describe("LuthieryWorkbench interactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("supports keyboard and touch selection directly on the instrument preview", () => {
    render(<LuthieryWorkbench materialsCatalog={materials} playerMaterials={stock} />);

    const electronics = screen.getByRole("button", { name: "Select electronics" });
    fireEvent.keyDown(electronics, { key: "Enter" });
    expect(screen.getByText("Part 4 / 5")).toBeInTheDocument();

    const neck = screen.getByRole("button", { name: "Select neck" });
    fireEvent.touchEnd(neck);
    expect(screen.getByText("Part 2 / 5")).toBeInTheDocument();
  });

  it("visibly changes pickups when a different electronics assembly is selected", async () => {
    const user = userEvent.setup();
    render(<LuthieryWorkbench materialsCatalog={materials} playerMaterials={stock} />);

    await user.click(screen.getByRole("button", { name: "Select electronics" }));
    await user.click(screen.getByRole("button", { name: /Hand-wound Boutique/i }));

    const group = screen.getByTestId("instrument-part-electronics");
    expect(group.querySelector("rect")).toHaveAttribute("fill", "#b58a3e");
  });

  it("places and moves artwork on the live preview", async () => {
    const user = userEvent.setup();
    render(<LuthieryWorkbench materialsCatalog={materials} playerMaterials={stock} />);

    await user.click(screen.getByRole("button", { name: /Custom Artwork/i }));
    await user.click(screen.getByRole("button", { name: "Lightning" }));
    expect(screen.getByTestId("instrument-decal")).toBeInTheDocument();

    const horizontal = screen.getByRole("slider", { name: "Decal horizontal position" });
    fireEvent.change(horizontal, { target: { value: "75" } });
    expect(horizontal).toHaveValue("75");
  });

  it("reviews and confirms a fully stocked named five-part design without consuming stock", async () => {
    const user = userEvent.setup();
    render(<LuthieryWorkbench materialsCatalog={materials} playerMaterials={stock} />);

    await user.type(screen.getByLabelText("Instrument name"), "Thunder Road");
    await user.click(screen.getByRole("button", { name: "Review build" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Thunder Road")).toBeInTheDocument();
    expect(within(dialog).getByText("Design ready for crafting")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Confirm design" }));
    expect(screen.getByText("Design confirmed: Thunder Road")).toBeInTheDocument();

    expect(stock.find((entry) => entry.material_id === "maple")?.quantity).toBe(3);
  });


  it("submits a confirmed design through the Phase 4 craft action and surfaces the server result", async () => {
    const user = userEvent.setup();
    const result = {
      status: "completed" as const,
      craftId: "craft-1",
      equipmentId: "equipment-1",
      playerEquipmentId: "player-equipment-1",
      instrumentName: "Server Axe",
      instrumentKind: "electric_guitar" as const,
      rarity: "rare",
      qualityRoll: 2,
      finalQuality: 68,
      finalStats: { tone: 55, sustain: 54, stability: 58, output: 50, stagePresence: 44 },
      buildSpec: {},
    };
    const onCraft = vi.fn().mockResolvedValue(result);
    const onCrafted = vi.fn();

    render(
      <LuthieryWorkbench
        materialsCatalog={materials}
        playerMaterials={stock}
        onCraft={onCraft}
        onCrafted={onCrafted}
      />,
    );

    await user.type(screen.getByLabelText("Instrument name"), "Server Axe");
    await user.click(screen.getByRole("button", { name: "Review build" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm design" }));
    await user.click(screen.getByRole("button", { name: "Craft instrument" }));

    await waitFor(() => expect(onCraft).toHaveBeenCalledTimes(1));
    expect(onCraft.mock.calls[0][0]).toMatchObject({
      instrumentName: "Server Axe",
      instrumentKind: "electric_guitar",
      shapeId: "double-cut",
    });
    expect(onCraft.mock.calls[0][1]).toEqual(expect.stringContaining("luthiery-"));
    expect(onCrafted).toHaveBeenCalledWith(result);
    expect(screen.getByRole("button", { name: "Instrument crafted" })).toBeDisabled();
  });

  it("blocks confirmation when required inventory is missing", async () => {
    const user = userEvent.setup();
    render(<LuthieryWorkbench materialsCatalog={materials} playerMaterials={[]} />);

    await user.type(screen.getByLabelText("Instrument name"), "No Stock");
    await user.click(screen.getByRole("button", { name: "Review build" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Build is not ready")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm design" })).toBeDisabled();
  });
});
