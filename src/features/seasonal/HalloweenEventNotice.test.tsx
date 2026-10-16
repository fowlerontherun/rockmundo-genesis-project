// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useSiteConfig, DEFAULT_HALLOWEEN_EVENT } from "@/hooks/useSiteConfig";
import { halloweenDismissalKey } from "./halloween2026";
import { HalloweenDashboardBanner, HalloweenLoginAnnouncement, HalloweenPublicBanner } from "./HalloweenEventNotice";

vi.mock("@/hooks/useSiteConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useSiteConfig")>();
  return { ...actual, useSiteConfig: vi.fn() };
});
// Test the event's own open/close, accessibility and CTA behavior without
// depending on Radix portal animations/focus-trap scheduling.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
const live = { ...DEFAULT_HALLOWEEN_EVENT, enabled: true, rewards_live: true };
function setEvent(event: typeof live) {
  vi.mocked(useSiteConfig).mockReturnValue({ data: { halloween: event } } as ReturnType<typeof useSiteConfig>);
}
const Location = () => <output data-testid="location">{useLocation().pathname}</output>;
const wrap = (ui: ReactNode) => render(<MemoryRouter initialEntries={["/home"]}>{ui}<Location /></MemoryRouter>);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
  window.localStorage.clear();
  setEvent(live);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("Halloween login event", () => {
  it("opens once for an eligible character and accurately describes all three rewards and the deadline", () => {
    const { unmount } = wrap(<HalloweenLoginAnnouncement userId="u1" profileId="c1" />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Haunted Stage 2026 is live!/i)).toBeTruthy();
    expect(within(dialog).getByText(/\+5%, \+10% or \+15%/)).toBeTruthy();
    expect(within(dialog).getByText(/500 bonus XP/)).toBeTruthy();
    expect(within(dialog).getByText(/Pumpkin Headliner 2026/)).toBeTruthy();
    expect(within(dialog).getAllByText(/1 November 2026/)).toHaveLength(2);
    fireEvent.click(within(dialog).getByRole("button", { name: "Maybe later" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(halloweenDismissalKey("u1","c1"))).toBe("seen");
    unmount();
    wrap(<HalloweenLoginAnnouncement userId="u1" profileId="c1" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("allows a second character to see the popup and opens the real avatar designer", () => {
    localStorage.setItem(halloweenDismissalKey("u1","c1"), "seen");
    wrap(<HalloweenLoginAnnouncement userId="u1" profileId="c2" />);
    const equip = screen.getByRole("link", { name: "Equip my Pumpkin Hat" });
    expect(equip.getAttribute("href")).toBe("/avatar-designer");
    fireEvent.click(equip);
    expect(screen.getByTestId("location").textContent).toBe("/avatar-designer");
    expect(localStorage.getItem(halloweenDismissalKey("u1","c2"))).toBe("seen");
  });

  it("does not show an event to guests, before launch, after expiry or when either rollout gate is off", () => {
    const cases = [
      { event: live, clock: "2026-10-31T12:00:00Z", user: null, profile: "c1" },
      { event: live, clock: "2026-10-31T12:00:00Z", user: "u1", profile: null },
      { event: live, clock: "2026-10-23T22:59:59Z", user: "u1", profile: "c1" },
      { event: live, clock: "2026-11-02T00:00:00Z", user: "u1", profile: "c1" },
      { event: { ...live, enabled: false }, clock: "2026-10-31T12:00:00Z", user: "u1", profile: "c1" },
      { event: { ...live, rewards_live: false }, clock: "2026-10-31T12:00:00Z", user: "u1", profile: "c1" },
    ];
    for (const test of cases) {
      vi.setSystemTime(new Date(test.clock));
      setEvent(test.event);
      const rendered = wrap(<HalloweenLoginAnnouncement userId={test.user} profileId={test.profile} />);
      expect(screen.queryByRole("dialog")).toBeNull();
      rendered.unmount();
    }
  });
});

describe("event reminders", () => {
  it("keeps an event card visible after dismissing the welcome and has a working details action", () => {
    localStorage.setItem(halloweenDismissalKey("u1","c1"), "seen");
    wrap(<><HalloweenLoginAnnouncement userId="u1" profileId="c1" /><HalloweenDashboardBanner /></>);
    const card = screen.getByRole("region", { name: "Active Halloween event" });
    expect(within(card).getByText(/Ends in 2 days/)).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Equip hat" }).getAttribute("href")).toBe("/avatar-designer");
    fireEvent.click(within(card).getByRole("button", { name: "Event details" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText(/Pumpkin Headliner/)).toBeTruthy();
  });

  it("public link is visible on landing but hidden on the auth page", () => {
    const a = wrap(<HalloweenPublicBanner />);
    expect(screen.getByRole("link", { name: "Log in to participate" }).getAttribute("href")).toBe("/auth");
    a.unmount();
    wrap(<HalloweenPublicBanner showLoginLink={false} />);
    expect(screen.queryByRole("link", { name: "Log in to participate" })).toBeNull();
    expect(screen.getByText(/Haunted Stage 2026 is live!/)).toBeTruthy();
  });

  it("hides every event surface after expiration regardless of whether it was dismissed", () => {
    vi.setSystemTime(new Date("2026-11-02T00:00:00Z"));
    wrap(<><HalloweenLoginAnnouncement userId="u1" profileId="c1" /><HalloweenDashboardBanner /><HalloweenPublicBanner /></>);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("region", { name: "Active Halloween event" })).toBeNull();
    expect(screen.queryByText(/Haunted Stage 2026 is live!/)).toBeNull();
  });
});
