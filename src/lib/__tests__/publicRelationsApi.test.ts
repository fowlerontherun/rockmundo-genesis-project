import { describe, expect, test } from "bun:test";

const localStorageMock = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};

(globalThis as any).localStorage = (globalThis as any).localStorage ?? localStorageMock;

const { createPublicRelationsApi } = await import("../publicRelationsApi");

const buildSelectQuery = (result: { data: any; error: any }, calls: string[]) => {
  return {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order() {
      calls.push("order");
      return Promise.resolve(result);
    },
  } as any;
};

const buildInsertQuery = (result: { data: any; error: any }, insertPayloads: any[]) => {
  return {
    insert(payload: any) {
      insertPayloads.push(payload);
      return this;
    },
    select() {
      return this;
    },
    single() {
      return Promise.resolve(result);
    },
  } as any;
};

const buildUpdateQuery = (result: { error: any }, updatePayloads: any[]) => {
  return {
    update(payload: any) {
      updatePayloads.push(payload);
      return { eq: () => Promise.resolve(result) } as any;
    },
  } as any;
};

describe("publicRelationsApi", () => {
  test("fetches campaigns, appearances, and offers with the correct filters", async () => {
    const campaignsResult = { data: [{ id: "c1" }], error: null };
    const appearancesResult = { data: [{ id: "a1" }], error: null };
    const offersResult = { data: [{ id: "o1" }], error: null };
    const calls: string[] = [];
    const fromCalls: string[] = [];

    const mockClient = {
      from(table: string) {
        fromCalls.push(table);
        if (table === "pr_campaigns") return buildSelectQuery(campaignsResult, calls);
        if (table === "media_appearances") return buildSelectQuery(appearancesResult, calls);
        if (table === "media_offers") return buildSelectQuery(offersResult, calls);
        throw new Error(`Unexpected table ${table}`);
      },
    } as any;

    const api = createPublicRelationsApi(mockClient);
    const campaigns = await api.fetchCampaigns("band-1");
    const appearances = await api.fetchMediaAppearances("band-1");
    const offers = await api.fetchMediaOffers("band-1");

    expect(campaigns).toEqual(campaignsResult.data);
    expect(appearances).toEqual(appearancesResult.data);
    expect(offers).toEqual(offersResult.data);
    expect(fromCalls).toEqual(["pr_campaigns", "media_appearances", "media_offers"]);
    expect(calls.filter((c) => c === "order").length).toBe(3);
  });

  test("creates campaigns with band context", async () => {
    const insertResult = { data: { id: "new" }, error: null };
    const insertPayloads: any[] = [];
    const mockClient = {
      from(table: string) {
        if (table === "pr_campaigns") return buildInsertQuery(insertResult, insertPayloads);
        throw new Error("unexpected table");
      },
    } as any;

    const api = createPublicRelationsApi(mockClient);
    const payload = {
      campaign_type: "press",
      campaign_name: "Run",
      budget: 1000,
      start_date: "2025-01-01",
      end_date: "2025-02-01",
    };

    const result = await api.createCampaign("band-33", payload);

    expect(result).toEqual(insertResult.data);
    expect(insertPayloads[0]).toEqual([{ ...payload, band_id: "band-33" }]);
  });

  test("updates offer responses and surfaces the status", async () => {
    const updateResult = { error: null };
    const updatePayloads: any[] = [];
    const mockClient = {
      from(table: string) {
        if (table === "media_offers") return buildUpdateQuery(updateResult, updatePayloads);
        throw new Error("unexpected table");
      },
    } as any;

    const api = createPublicRelationsApi(mockClient);
    const result = await api.respondToOffer("offer-9", true);

    expect(result).toEqual({ offerId: "offer-9", status: "accepted" });
    expect(updatePayloads[0]).toEqual({ status: "accepted" });
  });

  test("throws when the database returns an error", async () => {
    const errorResult = { data: null, error: { message: "boom" } };
    const mockClient = {
      from() {
        return buildSelectQuery(errorResult, []);
      },
    } as any;

    const api = createPublicRelationsApi(mockClient);

    await expect(api.fetchCampaigns("band-err")).rejects.toThrow(/boom/);
  });
});
