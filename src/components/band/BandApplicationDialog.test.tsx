import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
const invalidateQueries = vi.fn();
const toast = vi.fn();
let mutationPending = false;

type MutationOptions = {
  mutationFn: () => Promise<unknown>;
  onSuccess?: (result: unknown) => void;
  onError?: (error: unknown) => void;
};

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (options: MutationOptions) => {
    mutate.mockImplementation(async () => {
      try {
        const result = await options.mutationFn();
        options.onSuccess?.(result);
      } catch (error) {
        options.onError?.(error);
      }
    });
    return { mutate, isPending: mutationPending };
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/services/bandApplications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/bandApplications")>();
  return {
    ...actual,
    submitBandApplication: vi.fn(async () => ({ id: "app-1", band_id: "11111111-1111-4111-8111-111111111111", status: "pending" })),
  };
});

import {
  DEFAULT_BAND_PERFORMANCE_ROLE,
  submitBandApplication,
} from "@/services/bandApplications";
import { BandApplicationDialog } from "./BandApplicationDialog";

const bandId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mutationPending = false;
});

describe("BandApplicationDialog", () => {
  it("submits through the guarded service and shows success state", async () => {
    const onSubmitted = vi.fn();
    render(<BandApplicationDialog bandId={bandId} bandName="The Tests" profileId="profile-1" onSubmitted={onSubmitted} />);

    fireEvent.click(screen.getByRole("button", { name: /apply to join/i }));
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Ready to rehearse." } });
    fireEvent.click(screen.getByRole("button", { name: /send application/i }));

    await waitFor(() => expect(submitBandApplication).toHaveBeenCalledWith(
      bandId,
      DEFAULT_BAND_PERFORMANCE_ROLE,
      "Ready to rehearse.",
    ));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Application Sent" }));
    expect(onSubmitted).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
  });

  it("validates unsupported roles and overlong/html messages before submit", async () => {
    render(<BandApplicationDialog bandId={bandId} bandName="The Tests" profileId="profile-1" />);
    fireEvent.click(screen.getByRole("button", { name: /apply to join/i }));
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "<b>bad</b>" } });
    fireEvent.click(screen.getByRole("button", { name: /send application/i }));
    expect(submitBandApplication).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Band application messages must be plain text.");
  });

  it("disables submit while saving", () => {
    mutationPending = true;
    render(<BandApplicationDialog bandId={bandId} bandName="The Tests" profileId="profile-1" />);
    fireEvent.click(screen.getByRole("button", { name: /apply to join/i }));
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
  });

  it("shows friendly backend errors", async () => {
    vi.mocked(submitBandApplication).mockRejectedValueOnce(new Error("This band is not accepting applications right now."));
    render(<BandApplicationDialog bandId={bandId} bandName="The Tests" profileId="profile-1" />);
    fireEvent.click(screen.getByRole("button", { name: /apply to join/i }));
    fireEvent.click(screen.getByRole("button", { name: /send application/i }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Error",
      description: "This band is not accepting applications right now.",
      variant: "destructive",
    })));
  });
});
