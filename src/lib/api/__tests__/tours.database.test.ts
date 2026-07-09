import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const { supabase } = await import("@/integrations/supabase/client");
const { createTour, deleteTour, getTour, listTours, updateTour } = await import("@/lib/api/tours");

const fromMock = vi.fn();
let query: any;
let result: any;

beforeEach(() => {
  result = { data: [], error: null };
  query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    single: vi.fn(async () => result),
    then: (resolve: any) => Promise.resolve(resolve(result)),
  };
  fromMock.mockReturnValue(query);
  (supabase as any).from = fromMock;
  vi.clearAllMocks();
});

describe("database service smoke tests", () => {
  it("lists tours ordered by start date and filters by band", async () => {
    result.data = [{ id: "tour-1", band_id: "band-1" }];

    await expect(listTours("band-1")).resolves.toHaveLength(1);

    expect(fromMock).toHaveBeenCalledWith("tours");
    expect(query.order).toHaveBeenCalledWith("start_date", { ascending: true });
    expect(query.eq).toHaveBeenCalledWith("band_id", "band-1");
  });

  it("maps a missing tour response to null", async () => {
    result = { data: null, error: { code: "PGRST116" } };

    await expect(getTour("missing-tour")).resolves.toBeNull();
  });

  it("creates and updates tours with camelCase API inputs converted to database columns", async () => {
    query.single.mockResolvedValueOnce({ data: { id: "tour-2" }, error: null });
    await createTour({ name: "Beta Run", bandId: "band-2", userId: "user-2", startDate: "2026-08-01", endDate: "2026-08-10" } as any);
    expect(query.insert).toHaveBeenCalledWith([{ name: "Beta Run", band_id: "band-2", user_id: "user-2", start_date: "2026-08-01", end_date: "2026-08-10" }]);

    query.single.mockResolvedValueOnce({ data: { id: "tour-2", name: "Beta Run Deluxe" }, error: null });
    await updateTour("tour-2", { name: "Beta Run Deluxe", bandId: "band-3" } as any);
    expect(query.update).toHaveBeenCalledWith({ name: "Beta Run Deluxe", band_id: "band-3" });
    expect(query.eq).toHaveBeenCalledWith("id", "tour-2");
  });

  it("deletes a tour by id", async () => {
    await expect(deleteTour("tour-3")).resolves.toBeUndefined();
    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("id", "tour-3");
  });
});
