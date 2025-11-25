import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const localStorageMock = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

const fromMock = vi.fn();
const inserts: Array<{ table: string; payload: unknown }> = [];
const updates: Array<{ table: string; payload: unknown }> = [];
let tableMocks: Record<string, any> = {};

const { validateTravelEligibility } = await import("@/utils/travelSystem");
const { acceptGigOffer, detectGigConflicts, generateGigOffersForBand } = await import("@/utils/gigOfferGenerator");
const { applyRoyaltyRecoupment } = await import("@/utils/contracts");
const { supabase } = await import("@/integrations/supabase/client");

const createQuery = (table: string) => {
  const mock = tableMocks[table] ?? {};
  const selectResult = { data: mock.data ?? [], error: mock.error ?? null };

  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.neq = vi.fn(async () => selectResult);
  query.order = vi.fn(async () => selectResult);
  query.limit = vi.fn(async () => selectResult);
  query.single = vi.fn(async () => ({ data: mock.single ?? null, error: mock.error ?? null }));
  query.maybeSingle = vi.fn(async () => ({ data: mock.single ?? null, error: mock.error ?? null }));
  query.insert = vi.fn((payload: unknown) => {
    inserts.push({ table, payload });
    const insertResult = { data: mock.insert ?? payload, error: null };

    if (table === "gigs") {
      const selector = { single: vi.fn(async () => insertResult) };
      return { select: vi.fn(() => selector) };
    }

    return Promise.resolve(insertResult);
  });
  query.update = vi.fn((payload: unknown) => {
    updates.push({ table, payload });
    return {
      eq: vi.fn(async () => ({ data: mock.update ?? payload, error: null })),
    };
  });

  return query;
};

beforeEach(() => {
  tableMocks = {};
  inserts.length = 0;
  updates.length = 0;
  vi.restoreAllMocks();
  (supabase as any).from = fromMock;
  fromMock.mockImplementation((table: string) => createQuery(table));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("travel eligibility", () => {
  it("blocks travel when funds are insufficient", async () => {
    tableMocks.profiles = { single: { cash: 10 } };

    await expect(validateTravelEligibility("user-1", 50)).rejects.toThrow(
      "Insufficient funds for this travel",
    );
  });

  it("allows travel when balance covers the fare", async () => {
    tableMocks.profiles = { single: { cash: 500 } };

    await expect(validateTravelEligibility("user-2", 150)).resolves.toBe(true);
    expect(fromMock).toHaveBeenCalledWith("profiles");
  });
});

describe("gig offers", () => {
  it("generates deterministic offers with venue-adjusted payouts", async () => {
    tableMocks.bands = { single: { fame: 3000, genre: "rock" } };
    tableMocks.promoters = { data: [{ id: "p1", name: "Pulse Live" }] };
    tableMocks.venues = { data: [{ id: "v1", name: "Atlas Hall", economy_factor: 1.25 }] };
    tableMocks.gig_offers = {};

    vi.spyOn(Math, "random").mockReturnValue(0.05);

    await generateGigOffersForBand("band-1", 2);

    expect(inserts).toHaveLength(1);
    const [insertCall] = inserts;
    const offers = insertCall.payload as Array<Record<string, unknown>>;
    expect(offers).toHaveLength(2);
    expect(offers[0]?.slot_type).toBe("support");
    expect(offers[0]?.base_payout).toBe(Math.floor(500 * (1 + 0.3) * 1.25));
    expect(offers[0]?.metadata).toMatchObject({ venue_name: "Atlas Hall", promoter_name: "Pulse Live" });
  });
});

describe("accepting gig offers", () => {
  it("activates a gig when no conflicts or expiry exist", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    tableMocks.gig_offers = {
      single: {
        id: "offer-1",
        band_id: "band-99",
        venue_id: "v-1",
        promoter_id: "p-1",
        offered_date: futureDate.toISOString(),
        expires_at: futureDate.toISOString(),
        status: "pending",
        slot_type: "headline",
        ticket_price: 40,
      },
    };
    tableMocks.gigs = { data: [], insert: { id: "new-gig" } };

    const result = await acceptGigOffer("offer-1");

    expect(result).toEqual({ gigId: "new-gig", error: null });
    expect(updates.some((entry) => entry.table === "gig_offers" && (entry.payload as any).status === "accepted")).toBe(
      true,
    );
  });

  it("rejects expired offers", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    tableMocks.gig_offers = {
      single: {
        id: "offer-2",
        band_id: "band-1",
        venue_id: "v-1",
        promoter_id: "p-1",
        offered_date: pastDate.toISOString(),
        expires_at: pastDate.toISOString(),
        status: "pending",
        slot_type: "support",
        ticket_price: 25,
      },
    };

    const result = await acceptGigOffer("offer-2");
    expect(result.error).toBe("Offer has expired");
  });
});

describe("royalty recoupment", () => {
  it("applies earnings against outstanding balances and returns remaining cash", async () => {
    tableMocks.contracts = {
      data: [
        { id: "c1", advance_balance: 1500, recouped_amount: 500 },
        { id: "c2", advance_balance: 400, recouped_amount: 100 },
      ],
    };

    const result = await applyRoyaltyRecoupment("user-9", 1800);

    expect(result).toEqual({ cashToPlayer: 0, totalRecouped: 1800 });
    const advanceUpdates = updates.filter((entry) => entry.table === "contracts");
    expect(advanceUpdates).toHaveLength(2);
    expect(advanceUpdates[0]?.payload).toMatchObject({ advance_balance: 0, recouped_amount: 2000 });
    expect(advanceUpdates[1]?.payload).toMatchObject({ advance_balance: 100, recouped_amount: 400 });
  });
});

describe("conflict detection", () => {
  it("stores detected conflicts for back-to-back gigs", async () => {
    const now = new Date();
    const first = new Date(now);
    const second = new Date(now);
    second.setHours(second.getHours() + 3);

    tableMocks.gigs = {
      data: [
        { id: "g1", band_id: "band-7", scheduled_date: first.toISOString(), status: "scheduled" },
        { id: "g2", band_id: "band-7", scheduled_date: second.toISOString(), status: "scheduled" },
      ],
    };
    tableMocks.band_conflicts = {};

    const conflicts = await detectGigConflicts("band-7");

    expect(conflicts).toHaveLength(1);
    expect(inserts.some((entry) => entry.table === "band_conflicts" && (entry.payload as any[]).length === 1)).toBe(true);
  });
});
