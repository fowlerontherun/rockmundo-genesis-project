import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InterviewerStage } from "./InterviewerStage";
import { getInterviewPresenter } from "@/data/interviewPresenters";

const presenter = getInterviewPresenter("tv", "Rockmundo TV");
const base = {
  presenter,
  mediaType: "tv",
  outletName: "Rockmundo TV",
  showName: "Backstage",
  dialogue: "What inspired the new song?",
  guestName: "Taylor Chord",
  guestAvatarSrc: "data:image/png;base64,AAAA",
  guestStatus: "ready" as const,
  questionIndex: 0,
  phase: "question" as const,
};

afterEach(() => cleanup());

describe("interview two-person scene", () => {
  it("shows the current character and presenter in the same studio", () => {
    render(<InterviewerStage {...base} />);
    expect(screen.getByText(presenter.name)).toBeTruthy();
    expect(screen.getByText("Taylor Chord")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Saved Avatar V1 for Taylor Chord" })).toBeTruthy();
    expect(screen.getByText("Presenter camera")).toBeTruthy();
  });

  it("lets players change camera angles without changing the interview question", () => {
    render(<InterviewerStage {...base} />);
    const artist = screen.getByRole("button", { name: "Focus my avatar" });
    fireEvent.click(artist);
    expect(artist.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Artist camera")).toBeTruthy();
    expect(screen.getByText(/What inspired the new song/)).toBeTruthy();
  });

  it("automatically focuses the player after a response and prints their answer", () => {
    render(<InterviewerStage {...base} phase="reaction" playerLine="We wrote it together." dialogue="Interesting!" />);
    expect(screen.getByText("Artist camera")).toBeTruthy();
    expect(screen.getByText(/We wrote it together/)).toBeTruthy();
  });

  it("keeps the interview playable when avatar rendering fails", () => {
    const retry = vi.fn();
    render(<InterviewerStage {...base} guestAvatarSrc={null} guestStatus="unavailable" onAvatarRetry={retry} />);
    expect(screen.getByText("Avatar unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByText(/What inspired the new song/)).toBeTruthy();
  });
});
