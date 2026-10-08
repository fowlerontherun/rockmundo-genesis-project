import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

import CommunityRewards from "./CommunityRewards";

describe("CommunityRewards referral page recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a retryable in-page error when the referral dashboard cannot load", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "get_referral_dashboard") {
        return Promise.resolve({ data: null, error: { message: "Referral dashboard unavailable" } });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(
      <MemoryRouter>
        <CommunityRewards profileId="11111111-1111-4111-8111-111111111111" profileName="Tester" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Invite friends unavailable")).toBeInTheDocument();
    expect(screen.getByText("Referral dashboard unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("retries the referral dashboard after a transient failure", async () => {
    let attempts = 0;
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "get_referral_dashboard") {
        attempts += 1;
        if (attempts === 1) {
          return Promise.resolve({ data: null, error: { message: "Temporary failure" } });
        }
        return Promise.resolve({
          data: {
            code: "RM123456",
            stats: { joined: 0, qualified: 0, signup_rewarded: 0, vip_paid: 0, vip_rewarded: 0 },
            pending: { signup: 0, vip: 0, milestones: 0 },
            rewards: {},
            discord: { verified: false, rewarded: false },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(
      <MemoryRouter>
        <CommunityRewards profileId="11111111-1111-4111-8111-111111111111" profileName="Tester" />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("Invite your friends")).toBeInTheDocument());
    expect(mocks.rpc).toHaveBeenCalledWith("get_referral_dashboard", {
      p_profile_id: "11111111-1111-4111-8111-111111111111",
    });
  });
});
