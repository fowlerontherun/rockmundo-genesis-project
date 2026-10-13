import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompletedGigStageViewer } from "../CompletedGigStageViewer";
import {
  GigExperienceLoadError,
  normalizeGigExperienceFailure,
} from "../../diagnostics";

const { useGigExperienceMock, useGigViewerReplayMock } = vi.hoisted(() => ({
  useGigExperienceMock: vi.fn(),
  useGigViewerReplayMock: vi.fn(() => ({ isError: false })),
}));

vi.mock("../../hooks", () => ({
  useGigExperience: useGigExperienceMock,
  useGigViewerReplay: useGigViewerReplayMock,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("CompletedGigStageViewer diagnostics", () => {
  it("queries canonical replay only if its descriptor says ready", () => {
    useGigExperienceMock.mockReturnValue({ data: { viewer: { replayAvailable: false }, songs: [] }, isLoading: false, isError: false });
    render(<CompletedGigStageViewer gigId="11111111-1111-4111-8111-111111111111" />);
    expect(useGigViewerReplayMock).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", false);
  });
  it("shows a support reference and keeps retry available after a data failure", () => {
    const gigId = "11111111-1111-4111-8111-111111111111";
    const refetch = vi.fn();
    const failure = normalizeGigExperienceFailure(
      gigId,
      "gig",
      "gigs",
      { status: 400, code: "42703", message: "column gigs.result_ready_at does not exist" },
    );
    useGigExperienceMock.mockReturnValue({
      data: null,
      error: new GigExperienceLoadError(failure),
      isLoading: false,
      isError: true,
      refetch,
    });

    render(<CompletedGigStageViewer gigId={gigId} />);

    expect(screen.getByRole("heading", { name: "Stage view unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/database compatibility mismatch/i)).toBeInTheDocument();
    expect(screen.getByText("GIGVIEW-GIG-42703-11111111")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
