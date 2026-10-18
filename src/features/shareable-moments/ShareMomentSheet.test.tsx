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
  loadCaptureImage: vi.fn(() => Promise.resolve(new Image())),
}));

vi.mock("./gallery", () => ({
  saveShareMomentSnapshot: vi.fn(),
}));

vi.mock("./twaater", () => ({
  storeTwaaterShareDraft: vi.fn(),
  uploadShareCardToTwaater: vi.fn(),
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

describe("ShareMomentSheet avatar exports", () => {
  it("does not allow exporting an incomplete avatar image", () => {
    render(
      <MemoryRouter>
        <ShareMomentSheet moment={{ ...moment, promptOnly: false }} open onOpenChange={vi.fn()} avatarStatus="loading" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Rendering your player avatar for the image…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Post to Twaater" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy image" })).toBeDisabled();
  });

  it("preserves the player's edits when the avatar snapshot arrives late", () => {
    const initial = { ...moment, promptOnly: false };
    const view = render(
      <MemoryRouter>
        <ShareMomentSheet moment={initial} open onOpenChange={vi.fn()} avatarStatus="loading" />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Share headline" }), { target: { value: "My edited headline" } });
    view.rerender(
      <MemoryRouter>
        <ShareMomentSheet moment={{ ...initial, avatar: { dataUrl: "data:image/png;base64,abc", width: 720, height: 1080 } }} open onOpenChange={vi.fn()} avatarStatus="ready" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("textbox", { name: "Share headline" })).toHaveValue("My edited headline");
  });

  it("shows a retry when an avatar could not be rendered", () => {
    const retry = vi.fn();
    render(
      <MemoryRouter>
        <ShareMomentSheet moment={{ ...moment, promptOnly: false }} open onOpenChange={vi.fn()} avatarStatus="unavailable" onAvatarRetry={retry} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Your avatar could not be rendered/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry avatar" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
