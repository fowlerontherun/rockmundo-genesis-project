import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const { supabase } = await import("@/integrations/supabase/client");
const { getTour, listTours, updateTour } = await import("@/lib/api/tours");

const fromMock = vi.fn();
const rpcMock = vi.fn();
let query: any;
let result: any;

beforeEach(() => {
  result = { data: [], error: null };
  query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => result),
    then: (resolve: any) => Promise.resolve(resolve(result)),
  };
  fromMock.mockReturnValue(query);
  rpcMock.mockResolvedValue({ data: { id: "tour-2", name: "Beta Run Deluxe" }, error: null });
  (supabase as any).from = fromMock;
  (supabase as any).rpc = rpcMock;
  vi.clearAllMocks();
});

describe("tour database service", () => {
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

  it("updates safe metadata through the authoritative RPC", async () => {
    await expect(updateTour("tour-2", { name: "Beta Run Deluxe" } as any)).resolves.toMatchObject({
      id: "tour-2",
      name: "Beta Run Deluxe",
    });

    expect(rpcMock).toHaveBeenCalledWith("update_tour_metadata", {
      p_tour_id: "tour-2",
      p_name: "Beta Run Deluxe",
    });
    expect(fromMock).not.toHaveBeenCalledWith("tours");
  });

  it("propagates authoritative update failures", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error("tour_update_forbidden") });

    await expect(updateTour("tour-2", { name: "Blocked" } as any)).rejects.toThrow("tour_update_forbidden");
  });
});
