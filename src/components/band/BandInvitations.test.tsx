import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
const invalidateQueries = vi.fn();
const toast = vi.fn();
const refetch = vi.fn();

type QueryState = {
  data?: unknown[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: typeof refetch;
};

type QueryOptions = { queryKey: string[]; queryFn: () => Promise<unknown> };
type MutationVariables = { invitationId: string; status: "accepted" | "declined" };
type MutationResult = { id: string; status: string };
type MutationOptions = {
  mutationFn: (variables: MutationVariables) => Promise<MutationResult>;
  onSuccess?: (result: MutationResult, variables: MutationVariables) => void | Promise<void>;
  onError?: (error: unknown, variables: MutationVariables) => void;
};

let queryState: QueryState;
let capturedQueryOptions: QueryOptions;

const invitation = {
  id: "33333333-3333-4333-8333-333333333333",
  band_id: "11111111-1111-4111-8111-111111111111",
  instrument_role: "Electric Guitar",
  vocal_role: null,
  message: "Join us",
  created_at: "2026-09-03T12:00:00Z",
  bands: { name: "The Testers", genre: "Rock", status: "active", is_solo_artist: false },
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    if (options.queryKey[0] === "active-band-membership") {
      return { data: null, isLoading: false };
    }
    capturedQueryOptions = options;
    return queryState;
  },
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (options: MutationOptions) => {
    mutate.mockImplementation(async (vars: MutationVariables) => {
      try {
        const result = await options.mutationFn(vars);
        await options.onSuccess?.(result, vars);
      } catch (error) {
        options.onError?.(error, vars);
      }
    });
    return { mutate, isPending: false };
  },
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useBandInvitationsRealtime", () => ({ useBandInvitationsRealtime: vi.fn() }));
vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({ profileId: "profile-1", userId: "user-1" }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));
vi.mock("@/services/bandInvitations", () => ({
  respondBandInvitation: vi.fn(async (invitationId: string, status: string) => ({
    id: invitationId,
    status,
  })),
}));

import { supabase } from "@/integrations/supabase/client";
import { respondBandInvitation } from "@/services/bandInvitations";
import { BandInvitations } from "./BandInvitations";
import { useBandInvitationsRealtime } from "@/hooks/useBandInvitationsRealtime";

beforeEach(() => {
  vi.clearAllMocks();
  queryState = {
    data: [invitation],
    isLoading: false,
    isError: false,
    error: null,
    refetch,
  };
});

describe("BandInvitations", () => {
  it("refreshes an incoming invitation immediately and invalidates membership after acceptance", () => {
    render(<BandInvitations />);
    const realtime = vi.mocked(useBandInvitationsRealtime).mock.calls[0][0];
    expect(realtime.filterColumn).toBe("invited_user_id");
    expect(realtime.filterValue).toBe("user-1");
    act(() => realtime.onChange({ eventType: "INSERT", status: "pending" }));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["band-invitations", "user-1", "profile-1"] });

    invalidateQueries.mockClear();
    act(() => realtime.onChange({ eventType: "UPDATE", status: "accepted" }));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["band-invitations", "user-1", "profile-1"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["user-bands"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["active-band-membership"] });
  });

  it("accepts through the guarded service and refreshes local membership state", async () => {
    const onMembershipChanged = vi.fn();
    render(<BandInvitations onMembershipChanged={onMembershipChanged} />);

    fireEvent.click(screen.getByRole("button", { name: /accept invitation/i }));

    await waitFor(() => expect(respondBandInvitation).toHaveBeenCalledWith(invitation.id, "accepted"));
    expect(onMembershipChanged).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["user-bands"] });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invitation Accepted" }));
  });

  it("scopes pending invitations to the active character", async () => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      or: vi.fn(),
      order: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValueOnce(chain as never);

    render(<BandInvitations />);
    await capturedQueryOptions.queryFn();

    expect(chain.eq).toHaveBeenCalledWith("invited_user_id", "user-1");
    expect(chain.or).toHaveBeenCalledWith("invited_profile_id.eq.profile-1,invited_profile_id.is.null");
    expect(chain.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("shows a retry action when invitations cannot be loaded", () => {
    queryState = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Invitation query failed"),
      refetch,
    };

    render(<BandInvitations />);
    expect(screen.getByRole("alert")).toHaveTextContent("Invitation query failed");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps decline available when the source band no longer exists", async () => {
    queryState = {
      data: [{ ...invitation, bands: null }],
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    };
    render(<BandInvitations />);
    expect(screen.getByText("Unavailable band")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept invitation from unavailable band/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /decline invitation from unavailable band/i }));
    await waitFor(() => expect(respondBandInvitation).toHaveBeenCalledWith(invitation.id, "declined"));
  });
});
