import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useActiveProfile", () => ({ useActiveProfile: () => ({ profileId: "profile-1", userId: "user-fallback" }) }));

const { supabase } = await import("@/integrations/supabase/client");
const { BandCreationForm } = await import("@/components/band/BandCreationForm");

const fromMock = vi.fn();
const inserts: Array<{ table: string; payload: any }> = [];

const makeQuery = (table: string) => {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: [], error: null })),
    delete: vi.fn(() => query),
    insert: vi.fn((payload) => {
      inserts.push({ table, payload });
      return table === "bands"
        ? { select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "band-1" }, error: null })) })) }
        : Promise.resolve({ data: payload, error: null });
    }),
    single: vi.fn(async () => ({ data: null, error: null })),
  };
  return query;
};

beforeEach(() => {
  inserts.length = 0;
  fromMock.mockImplementation(makeQuery);
  (supabase as any).from = fromMock;
  (supabase.auth as any).getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }));
});

describe("band creation smoke tests", () => {
  it("creates a band row and founder membership from the form", async () => {
    const onBandCreated = vi.fn();
    render(<BandCreationForm onBandCreated={onBandCreated} />);

    fireEvent.change(screen.getByLabelText(/band name/i), { target: { value: "The Beta Beats" } });
    fireEvent.submit(screen.getByRole("button", { name: /create band/i }).closest("form")!);

    await waitFor(() => expect(onBandCreated).toHaveBeenCalled());
    expect(inserts).toEqual(expect.arrayContaining([
      { table: "bands", payload: expect.objectContaining({ name: "The Beta Beats", leader_id: "profile-1", max_members: 4, is_solo_artist: false }) },
      { table: "band_members", payload: expect.objectContaining({ band_id: "band-1", profile_id: "profile-1", user_id: "user-1", role: "Founder" }) },
    ]));
  });
});
