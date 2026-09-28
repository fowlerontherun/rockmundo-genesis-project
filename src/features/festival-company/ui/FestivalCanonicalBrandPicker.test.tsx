import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FestivalCanonicalBrandPicker } from "./FestivalCanonicalBrandPicker";

const { useFestivalCanonicalBrands, useAddFestivalCanonicalBrandProspect, add } = vi.hoisted(() => ({
  useFestivalCanonicalBrands: vi.fn(),
  useAddFestivalCanonicalBrandProspect: vi.fn(),
  add: vi.fn(),
}));

vi.mock("../application/useFestivalCanonicalBrands", () => ({
  useFestivalCanonicalBrands, useAddFestivalCanonicalBrandProspect,
}));

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const ALPHA_ID = "22222222-2222-4222-8222-222222222222";
const alpha = {
  brandId: ALPHA_ID,
  brandName: "Alpha Audio",
  logoUrl: null,
  category: "Audio",
  region: "UK",
  availableBudget: 5000,
  wealthScore: 50,
  exclusivityPref: false,
  alreadyProspected: false,
  alreadyContracted: false,
};
const beta = { ...alpha, brandId: "33333333-3333-4333-8333-333333333333", brandName: "Beta Sound", alreadyProspected: true };

describe("FestivalCanonicalBrandPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFestivalCanonicalBrands.mockReturnValue({
      isPending: false, isError: false, isSuccess: true,
      data: { items: [alpha, beta], totalCount: 65 },
    });
    useAddFestivalCanonicalBrandProspect.mockReturnValue({
      mutate: add, isPending: false, isError: false, isSuccess: false,
    });
  });

  it("filters by letter and resets paging, then supports reverse alphabetical sorting", () => {
    render(<FestivalCanonicalBrandPicker festivalCompanyId={COMPANY_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(useFestivalCanonicalBrands).toHaveBeenLastCalledWith(COMPANY_ID, "", "", "asc", 1);
    fireEvent.click(screen.getByRole("button", { name: "B", exact: true }));
    expect(useFestivalCanonicalBrands).toHaveBeenLastCalledWith(COMPANY_ID, "", "B", "asc", 0);
    expect(screen.getByRole("button", { name: "B", exact: true }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "desc" } });
    expect(useFestivalCanonicalBrands).toHaveBeenLastCalledWith(COMPANY_ID, "", "B", "desc", 0);
  });

  it("keeps search and letter filtering together", () => {
    render(<FestivalCanonicalBrandPicker festivalCompanyId={COMPANY_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "A", exact: true }));
    fireEvent.change(screen.getByPlaceholderText("Brand name or category"), { target: { value: "audio" } });
    fireEvent.click(screen.getByRole("button", { name: "Search brands" }));
    expect(useFestivalCanonicalBrands).toHaveBeenLastCalledWith(COMPANY_ID, "audio", "A", "asc", 0);
  });

  it("adds a prospect but prevents already selected brands being added twice", () => {
    render(<FestivalCanonicalBrandPicker festivalCompanyId={COMPANY_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Add prospect" }));
    expect(add).toHaveBeenCalledWith({ festivalCompanyId: COMPANY_ID, brandId: ALPHA_ID });
    expect(screen.getByRole("button", { name: "Added" }).hasAttribute("disabled")).toBe(true);
  });
});
