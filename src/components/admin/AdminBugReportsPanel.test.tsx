import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updates: [] as Array<Record<string, unknown>>,
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import AdminBugReportsPanel from "./AdminBugReportsPanel";

const report = {
  id: "report-1",
  user_id: "user-1",
  page_url: "/gigs/gig-1",
  category: "gameplay",
  severity: "high",
  title: "Cannot finish gig",
  description: "The completion action returned an error.",
  steps_to_reproduce: "Open the gig and finish the set.",
  user_agent: "Test Browser",
  viewport: "390x844",
  status: "open",
  admin_notes: null,
  created_at: "2026-08-30T08:00:00.000Z",
  updated_at: "2026-08-30T08:00:00.000Z",
};

const createQueryBuilder = () => {
  let operation: "select" | "update" = "select";
  let updatePatch: Record<string, unknown> | null = null;
  const builder: any = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      mocks.filters.push([column, value]);
      return builder;
    }),
    update: vi.fn((patch: Record<string, unknown>) => {
      operation = "update";
      updatePatch = patch;
      return builder;
    }),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      if (operation === "update" && updatePatch) mocks.updates.push(updatePatch);
      const response = operation === "select" ? { data: [report], error: null } : { data: null, error: null };
      return Promise.resolve(response).then(resolve, reject);
    },
  };
  return builder;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updates.length = 0;
  mocks.filters.length = 0;
  mocks.from.mockImplementation(() => createQueryBuilder());
  const realtimeChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  mocks.channel.mockReturnValue(realtimeChannel);
  mocks.removeChannel.mockResolvedValue(undefined);
});

describe("AdminBugReportsPanel", () => {
  it("loads open player reports and makes high-priority blockers visible", async () => {
    render(<AdminBugReportsPanel />);

    expect(await screen.findByText("Cannot finish gig")).toBeInTheDocument();
    expect(screen.getByText("1 open")).toBeInTheDocument();
    expect(screen.getByText("High-priority report awaiting review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "/gigs/gig-1" })).toHaveAttribute("href", "/gigs/gig-1");
    expect(mocks.filters).toContainEqual(["status", "open"]);
  });

  it("persists investigation notes without hiding the report", async () => {
    render(<AdminBugReportsPanel />);
    const notes = await screen.findByPlaceholderText("Add investigation notes, fix reference, PR number, etc.");

    fireEvent.change(notes, { target: { value: "Fixed by PR #999" } });
    fireEvent.blur(notes);

    await waitFor(() => expect(mocks.updates).toContainEqual({ admin_notes: "Fixed by PR #999" }));
    expect(screen.getByText("Cannot finish gig")).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Bug report updated");
  });
});
