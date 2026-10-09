import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  markSharePromptSeen: vi.fn(),
  trackShareAnalyticsEvent: vi.fn(),
}));

vi.mock("./prompts", () => ({
  markSharePromptSeen: mocks.markSharePromptSeen,
}));

vi.mock("./analytics", () => ({
  trackShareAnalyticsEvent: mocks.trackShareAnalyticsEvent,
}));

vi.mock("./canvas", () => ({
  canvasBlob: vi.fn(),
  renderShareMoment: vi.fn(),
  shareFilename: vi.fn(() => "share.png"),
}));

vi.mock("./avatarCapture", () => ({
  loadCaptureImage: vi.fn(),
}));

vi.mock("./gallery", () => ({
  saveShareMomentSnapshot: vi.fn(),
}));

vi.mock("./twaater", () => ({
  storeTwaaterShareDraft: vi.fn(),
  uploadShareCardToTwaater: vi.fn(),
  removeUnpublishedShareCard: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { ShareMomentSheet } from "./ShareMomentSheet";
import type { ShareMoment } from "./types";

const moment: ShareMoment = {
  version: 1,
  type: "achievement",
  id: "milestone-1",
  headline: "Hit a milestone",
  subheadline: "Worth sharing",
  destinationUrl: "https://rockmundo.uk/profile",
  referralCode: null,
  createdAt: new Date().toISOString(),
  promptOnly: true,
  promptKind: "fame-milestone",
  promptSourceId: "milestone-1",
  promptLabel: "Share fame milestone",
};

describe("ShareMomentSheet contextual prompt gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a prominent share card without opening the full sheet", () => {
    render(
      <MemoryRouter>
        <ShareMomentSheet moment={moment} open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("region", { name: "Share this RockMundo moment" })).toBeInTheDocument();
    expect(screen.getByText("Shareable moment")).toBeInTheDocument();
    expect(screen.getByText("Hit a milestone")).toBeInTheDocument();
    expect(screen.getByText("Worth sharing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share fame milestone" })).toBeInTheDocument();
    expect(screen.queryByText("Share your RockMundo moment")).not.toBeInTheDocument();
    expect(mocks.markSharePromptSeen).not.toHaveBeenCalled();
  });

  it("dismisses the contextual prompt without opening Share Studio", () => {
    const onOpenChange = vi.fn();
    render(
      <MemoryRouter>
        <ShareMomentSheet moment={moment} open onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(mocks.markSharePromptSeen).toHaveBeenCalledWith("fame-milestone", "milestone-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Share your RockMundo moment")).not.toBeInTheDocument();
  });

  it("opens the full share sheet only after the player clicks the contextual button", () => {
    render(
      <MemoryRouter>
        <ShareMomentSheet moment={moment} open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share fame milestone" }));

    expect(mocks.markSharePromptSeen).toHaveBeenCalledWith("fame-milestone", "milestone-1");
    expect(screen.getByText("Share your RockMundo moment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post to Twaater" })).toBeInTheDocument();
  });
});

describe("character promo avatar readiness", () => {
  it("prevents sharing while Avatar V1 capture is missing", () => {
    render(
      <MemoryRouter>
        <ShareMomentSheet
          moment={{ ...moment, type: "character_profile", promptOnly: false }}
          open
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Share now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Post to Twaater" })).toBeDisabled();
    expect(screen.getByText(/Avatar preview unavailable/)).toBeInTheDocument();
  });
});
