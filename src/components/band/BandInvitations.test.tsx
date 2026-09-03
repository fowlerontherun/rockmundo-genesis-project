import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

type QueryOptions = { queryFn: () => Promise<unknown> };
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
  bands: { name: "The Testers", genre: "Rock" },
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
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
});
