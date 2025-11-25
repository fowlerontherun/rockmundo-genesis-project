import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enforceVoteCap,
  getNextStatus,
  isValidStatusTransition,
  selectRandomNomineesByCountry,
  validateNominationSubmission,
} from "../awards";

const createSequenceRandom = (sequence: number[]) => {
  let index = 0;
  return () => {
    const value = sequence[index % sequence.length];
    index += 1;
    return value;
  };
};

describe("validateNominationSubmission", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects missing award_show_id, category_name, or nominee_name", () => {
    expect(() =>
      validateNominationSubmission({
        award_show_id: "",
        category_name: "",
        nominee_type: "band",
        nominee_id: "123",
        nominee_name: "",
      }),
    ).toThrow("Missing required fields: award_show_id, category_name, nominee_name");
  });
});

describe("selectRandomNomineesByCountry", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns exactly one entry per country", () => {
    const submissions = [
      { id: "1", country: "US" },
      { id: "2", country: "US" },
      { id: "3", country: "UK" },
      { id: "4", country: "UK" },
      { id: "5", country: "CA" },
    ];

    const random = createSequenceRandom([0.1, 0.9, 0.5]);
    const selections = selectRandomNomineesByCountry(submissions, random);

    const countries = selections.map((entry) => entry.country);
    expect(selections).toHaveLength(3);
    expect(new Set(countries).size).toBe(3);
  });
});

describe("enforceVoteCap", () => {
  afterEach(() => vi.restoreAllMocks());

  it("blocks further votes once the per-nomination limit is reached", () => {
    expect(() => enforceVoteCap(3, 3)).toThrow("Vote limit reached for this nomination");
    expect(enforceVoteCap(2, 3)).toBe(1);
  });

  it("allows supabase interactions to be safely mocked", async () => {
    const supabaseStub = {
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ data: { id: "1" }, error: null }),
      })),
    };

    const fromSpy = vi.spyOn(supabaseStub, "from");
    const query = supabaseStub.from("award_votes");
    const selectSpy = vi.spyOn(query, "select");
    await query.select();

    expect(fromSpy.mock.calls.length).toBe(1);
    expect(selectSpy.mock.calls.length).toBe(1);
  });
});

describe("status progression", () => {
  afterEach(() => vi.restoreAllMocks());

  it("allows only valid transitions", () => {
    expect(isValidStatusTransition("nominations_open", "selection")).toBe(true);
    expect(isValidStatusTransition("selection", "live")).toBe(true);
    expect(isValidStatusTransition("voting_open", "results")).toBe(true);
    expect(isValidStatusTransition("results", "nominations_open")).toBe(false);
  });

  it("throws on disallowed progression attempts", () => {
    expect(() => getNextStatus("selection", "results")).toThrow(
      "Invalid status transition from selection to results",
    );
    expect(() => getNextStatus("results", "live")).toThrow(
      "Invalid status transition from results to live",
    );
  });
});
