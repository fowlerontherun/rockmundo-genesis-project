import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LuthieryShopPanel } from "@/components/crafting/LuthieryShopPanel";
import { useLuthieryShops } from "@/hooks/useLuthieryShops";

vi.mock("@/hooks/useLuthieryShops", () => ({
  useLuthieryShops: vi.fn(),
}));

const mockedUseLuthieryShops = vi.mocked(useLuthieryShops);

const baseHook = {
  profile: {
    id: "profile-buyer",
    username: "buyer",
    display_name: "Buyer",
    cash: 250000,
    current_city_id: "city-1",
    city: { id: "city-1", name: "London", country: "United Kingdom" },
  },
  levels: { basic: 20, professional: 0, mastery: 0 },
  isQualified: true,
  shops: [],
  listings: [],
  myShop: null,
  myListings: [],
  salesHistory: [],
  ownedInstruments: [],
  availableInstruments: [],
  isLoading: false,
  openShop: vi.fn().mockResolvedValue({}),
  updateShop: vi.fn().mockResolvedValue({}),
  createListing: vi.fn().mockResolvedValue({}),
  cancelListing: vi.fn().mockResolvedValue({}),
  purchaseListing: vi.fn().mockResolvedValue({ status: "completed" }),
  isOpeningShop: false,
  isUpdatingShop: false,
  isCreatingListing: false,
  isCancellingListing: false,
  isPurchasing: false,
};

describe("LuthieryShopPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseLuthieryShops.mockReturnValue({ ...baseHook } as any);
  });

  it("shows verified provenance and buys a player-crafted instrument", async () => {
    const user = userEvent.setup();
    const purchaseListing = vi.fn().mockResolvedValue({ status: "completed" });

    mockedUseLuthieryShops.mockReturnValue({
      ...baseHook,
      purchaseListing,
      listings: [
        {
          id: "listing-1",
          shop_id: "shop-1",
          is_own_listing: false,
          seller_profile_id: "profile-seller",
          player_equipment_id: "owned-1",
          equipment_id: "equipment-1",
          craft_id: "craft-1",
          maker_profile_id: "profile-maker",
          maker_name: "Ava Strings",
          instrument_name: "Midnight Double Cut",
          instrument_kind: "electric_guitar",
          rarity: "epic",
          final_quality: 88,
          condition_at_listing: 96,
          asking_price: 125000,
          material_cost_basis: 60000,
          suggested_value: 130000,
          commission_rate_at_listing: 7.5,
          description: "Stage-ready custom build",
          provenance_snapshot: {
            shapeId: "double-cut",
            shapeName: "Classic Double Cut",
            materialSnapshot: [
              { materialName: "Alder Body Blank" },
              { materialName: "Maple Neck Blank" },
            ],
          },
          stat_snapshot: { tone: 75 },
          status: "active",
          final_sale_price: null,
          listed_at: "2026-10-04T21:00:00Z",
          sold_at: null,
          shop: {
            id: "shop-1",
            owner_profile_id: "profile-seller",
            name: "Ava Custom Works",
            brand_tagline: "Built loud",
            brand_colour: "#b8892f",
            brand_logo_url: "https://example.test/ava-logo.png",
            city_id: "city-1",
            commission_rate: 7.5,
            reputation: 84.5,
            completed_sales: 12,
            cancelled_listings: 1,
            gross_sales: 900000,
            is_open: true,
            city: { id: "city-1", name: "London", country: "United Kingdom" },
          },
        },
      ],
    } as any);

    render(<LuthieryShopPanel />);

    expect(screen.getByText("Midnight Double Cut")).toBeInTheDocument();
    expect(screen.getByText(/Built by Ava Strings/)).toBeInTheDocument();
    expect(screen.getByText(/Alder Body Blank/)).toBeInTheDocument();
    expect(screen.getByText(/Ava Custom Works/)).toBeInTheDocument();
    expect(screen.getByText(/7.5%/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ava Custom Works logo" })).toHaveAttribute(
      "src",
      "https://example.test/ava-logo.png",
    );

    await user.click(screen.getByRole("button", { name: /Buy for/ }));
    expect(purchaseListing).toHaveBeenCalledWith("listing-1");
  });

  it("lets a qualified Luthier open a branded shop in their current city", async () => {
    const user = userEvent.setup();
    const openShop = vi.fn().mockResolvedValue({});

    mockedUseLuthieryShops.mockReturnValue({
      ...baseHook,
      openShop,
    } as any);

    render(<LuthieryShopPanel />);

    await user.click(screen.getByRole("tab", { name: "My instrument shop" }));
    await user.type(screen.getByLabelText("Shop name"), "Voltage Luthiery");
    await user.type(screen.getByLabelText("Brand tagline"), "Player-built stage weapons");
    await user.click(screen.getByRole("button", { name: "Open instrument shop" }));

    expect(openShop).toHaveBeenCalledWith(expect.objectContaining({
      name: "Voltage Luthiery",
      brandTagline: "Player-built stage weapons",
      brandColour: "#b8892f",
      commissionRate: 5,
    }));
    expect(screen.getByText(/London/)).toBeInTheDocument();
  });

  it("keeps shop creation locked until Basic Luthiery reaches level 20", async () => {
    const user = userEvent.setup();

    mockedUseLuthieryShops.mockReturnValue({
      ...baseHook,
      levels: { basic: 19, professional: 0, mastery: 0 },
      isQualified: false,
    } as any);

    render(<LuthieryShopPanel />);
    await user.click(screen.getByRole("tab", { name: "My instrument shop" }));

    expect(screen.getByText(/Basic Luthiery level 20/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open instrument shop" })).not.toBeInTheDocument();
  });
});
