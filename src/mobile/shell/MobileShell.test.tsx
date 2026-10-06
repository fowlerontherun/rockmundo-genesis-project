import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "./BottomNav";
import { FabMenu } from "./FabMenu";
import { MobileActivityBar } from "./MobileActivityBar";
import { useLanguageStore } from "@/hooks/useTranslation";

const mockGameData = vi.hoisted(() => ({
  activityStatus: null as any,
  profile: { display_name: "Test Player", username: "tester" },
}));

vi.mock("@/hooks/useGameData", () => ({ useGameData: () => mockGameData }));
vi.mock("@/hooks/useActiveProfile", () => ({ useActiveProfile: () => ({ userId: "user", profileId: "profile" }) }));
vi.mock("@/mobile/hooks/useMobileDaySchedule", () => ({ useMobileDaySchedule: () => ({ data: [] }) }));
vi.mock("@/hooks/useNotificationsFeed", () => ({ useNotificationsFeed: () => ({ unreadCount: 0, notifications: [], markRead: vi.fn(), isLoading: false }) }));

describe("mobile shell navigation", () => {
  it("renders the four companion navigation destinations without desktop navigation", () => {
    useLanguageStore.getState().setLanguage('en');
    render(<MemoryRouter initialEntries={["/career/songs"]}><BottomNav /></MemoryRouter>);
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
    for (const label of ["Schedule", "Inbox", "Chat", "XP / AP"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("ModuleTabs")).not.toBeInTheDocument();
  });

  it("shows scheduling, inbox, chat and progression quick actions", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/mobile/social"]}><FabMenu /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /open quick actions/i }));
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons.join(" ")).toMatch(/My Schedule.*Book Activity.*Inbox.*Game Chat.*Spend XP and AP/);
  });

  it("shows current activity bar only for active timed activities", () => {
    mockGameData.activityStatus = null;
    const { rerender } = render(<MemoryRouter><MobileActivityBar /></MemoryRouter>);
    expect(screen.queryByLabelText(/current activity/i)).not.toBeInTheDocument();
    mockGameData.activityStatus = { activity_type: "skill_practice", status: "active", ends_at: new Date(Date.now() + 900000).toISOString(), metadata: { title: "Practising Guitar" } };
    rerender(<MemoryRouter><MobileActivityBar /></MemoryRouter>);
    expect(screen.getByLabelText(/current activity: Practising Guitar/i)).toBeInTheDocument();
  });
});
