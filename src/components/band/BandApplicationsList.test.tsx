import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
const invalidateQueries = vi.fn();
const toast = vi.fn();
let queryState: any;
let mutationPending = false;

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => queryState,
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (options: any) => {
    mutate.mockImplementation(async (vars: any) => {
      try {
        const result = await options.mutationFn(vars);
        options.onSuccess?.(result, vars);
      } catch (error) {
        options.onError?.(error, vars);
      }
    });
    return { mutate, isPending: mutationPending };
  },
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@/services/bandApplications", () => ({
  respondBandApplication: vi.fn(async (applicationId: string, decision: string) => ({
    id: applicationId,
    band_id: "band-1",
    status: decision === "approve" ? "accepted" : "rejected",
  })),
}));

import { respondBandApplication } from "@/services/bandApplications";
import { BandApplicationsList } from "./BandApplicationsList";

const pendingApp = {
  id: "44444444-4444-4444-8444-444444444444",
  applicant_profile_id: "profile-1",
  instrument_role: "Guitar",
  vocal_role: "Lead Vocals",
  message: "I can rehearse nightly.",
  status: "pending",
  created_at: "2026-07-10T00:00:00Z",
  profiles: { display_name: "Riley Riff", username: "riley", avatar_url: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  mutationPending = false;
  queryState = { data: [pendingApp], isLoading: false, isError: false, error: null };
});

describe("BandApplicationsList", () => {
  it("shows application details and calls the guarded approval service", async () => {
    const onMemberAdded = vi.fn();
    render(<BandApplicationsList bandId="band-1" onMemberAdded={onMemberAdded} />);

    expect(screen.getByText("Riley Riff")).toBeInTheDocument();
    expect(screen.getByText("I can rehearse nightly.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /approve application/i }));

    await waitFor(() => expect(respondBandApplication).toHaveBeenCalledWith(pendingApp.id, "approve"));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Application Approved" }));
    expect(onMemberAdded).toHaveBeenCalled();
  });

  it("calls the guarded rejection service and shows success feedback", async () => {
    render(<BandApplicationsList bandId="band-1" />);
    fireEvent.click(screen.getByRole("button", { name: /reject application/i }));

    await waitFor(() => expect(respondBandApplication).toHaveBeenCalledWith(pendingApp.id, "reject"));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Application Rejected" }));
  });

  it("disables decision controls while saving", () => {
    mutationPending = true;
    render(<BandApplicationsList bandId="band-1" />);

    expect(screen.getByRole("button", { name: /approve application/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reject application/i })).toBeDisabled();
  });

  it("shows friendly backend errors", async () => {
    vi.mocked(respondBandApplication).mockRejectedValueOnce(new Error("You are not allowed to respond to applications for this band."));
    render(<BandApplicationsList bandId="band-1" />);
    fireEvent.click(screen.getByRole("button", { name: /approve application/i }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Error",
      description: "You are not allowed to respond to applications for this band.",
      variant: "destructive",
    })));
  });

  it("hides active decision controls for final-state applications", () => {
    queryState = { data: [{ ...pendingApp, status: "accepted" }], isLoading: false, isError: false, error: null };
    render(<BandApplicationsList bandId="band-1" />);

    expect(screen.queryByRole("button", { name: /approve application/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject application/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Accepted/).length).toBeGreaterThan(0);
  });
});
