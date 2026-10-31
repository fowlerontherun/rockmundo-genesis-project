import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScheduleWorkspace } from "./FestivalScheduleWorkspace";

const upsertItem = { mutate: vi.fn() };
const publish = { isPending: false, mutate: vi.fn() };
const reorderStage = { isPending: false, mutateAsync: vi.fn().mockResolvedValue({updated:2}) };
const previewTemplate = { mutate: vi.fn() };
const applyTemplate = { mutate: vi.fn() };

const workspace = {
  festival: { id: "festival-1", name: "Owner Fest" },
  edition: { id: "edition-1", title: "Owner Fest 2030" },
  timeZone: "Europe/London",
  festivalDates: ["2030-06-01"],
  scheduleState: "draft",
  draftRevision: { id: "revision-1", revision_number: 3, version: 5 },
  publishedRevision: null,
  revisionHistory: [],
  stages: [
    { id: "stage-main", public_name: "Main Stage" },
    { id: "stage-second", public_name: "Second Stage" },
  ],
  operatingHours: [],
  scheduleItems: [
    {
      id: "slot-1",
      festival_id: "festival-1",
      edition_id: "edition-1",
      stage_id: "stage-main",
      festival_date: "2030-06-01",
      item_type: "performance_slot",
      starts_at: "2030-06-01T18:00:00Z",
      ends_at: "2030-06-01T18:45:00Z",
      duration_minutes: 45,
      title: "Sunset opener",
      internal_notes: "Hold for local act",
      version: 2,
    },
  ],
  unscheduledItems: [],
  conflictSummary: { items: [], blockingCount: 0 },
  readinessSummary: {},
  permissions: { viewSchedule: true, manageSchedule: true },
  availableActions: ["manage_schedule", "publish_schedule"],
};

vi.mock("../hooks", () => ({
  useFestivalScheduleWorkspace: () => ({ data: workspace, isLoading: false, error: null }),
  useScheduleMutations: () => ({
    upsertItem,
    reorderStage,
    publish,
    previewTemplate,
    applyTemplate,
    configureHours: { mutate: vi.fn() },
    lock: { mutate: vi.fn() },
    reopen: { mutate: vi.fn() },
    discardDraft: { mutate: vi.fn() },
  }),
}));

// The accepted-booking finaliser has its own React Query behaviour and contract
// tests. Keep these schedule-workspace tests focused on the timeline/manual-slot
// surface instead of requiring an application QueryClientProvider.
vi.mock("./FestivalArtistScheduleFinaliser", () => ({
  FestivalArtistScheduleFinaliser: () => <div>Accepted artist bookings</div>,
}));

afterEach(() => {
  upsertItem.mutate.mockReset();
  reorderStage.mutateAsync.mockClear();
  publish.mutate.mockClear();
  previewTemplate.mutate.mockClear();
  applyTemplate.mutate.mockClear();
});

describe("FestivalScheduleWorkspace owner slot management", () => {
  it("shows the stage schedule timeline with existing festival slots", () => {
    render(<FestivalScheduleWorkspace editionId="edition-1" />);

    expect(screen.getByRole("heading", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByText("Accepted artist bookings")).toBeInTheDocument();
    expect(screen.getAllByText("Main Stage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Second Stage").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Sunset opener/i }).length).toBeGreaterThan(0);
  });

  it("previews and atomically submits a stage reorder", async () => {
    const second = {...workspace.scheduleItems[0], id: "slot-2", title: "Evening headline", starts_at: "2030-06-01T19:00:00Z", ends_at: "2030-06-01T20:00:00Z", duration_minutes: 60, version: 3};
    workspace.scheduleItems.push(second);
    try {
      render(<FestivalScheduleWorkspace editionId="edition-1" />);
      fireEvent.click(screen.getByRole("button", {name:"Preview moving Evening headline earlier"}));
      expect(screen.getByText("Proposed running order")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", {name:"Save proposed order"}));
      await waitFor(() => expect(reorderStage.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        editionId: "edition-1", revisionId: "revision-1", stageId: "stage-main",
        date: "2030-06-01", expectedRevisionVersion: 5,
        items: [
          expect.objectContaining({id:"slot-2", version:3}),
          expect.objectContaining({id:"slot-1", version:2}),
        ],
      })));
    } finally { workspace.scheduleItems.pop(); }
  });

  it("creates a manual festival slot in the owner schedule workspace", async () => {
    render(<FestivalScheduleWorkspace editionId="edition-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Manual slot/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("Title"), { target: { value: "Late night headline slot" } });
    fireEvent.change(within(dialog).getByDisplayValue("18:00"), { target: { value: "21:30" } });
    fireEvent.change(within(dialog).getByDisplayValue("45"), { target: { value: "75" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => expect(upsertItem.mutate).toHaveBeenCalled());
    expect(upsertItem.mutate.mock.calls[0][0]).toMatchObject({
      editionId: "edition-1",
      revisionId: "revision-1",
      item: {
        title: "Late night headline slot",
        itemType: "performance_slot",
        stageId: "stage-main",
        festivalDate: "2030-06-01",
        startsAt: "2030-06-01T20:30:00.000Z",
        endsAt: "2030-06-01T21:45:00.000Z",
        durationMinutes: 75,
        publicVisible: true,
      },
    });
  });

  it("edits an existing festival slot from the schedule inspector", async () => {
    render(<FestivalScheduleWorkspace editionId="edition-1" />);

    fireEvent.click(screen.getAllByRole("button", { name: /Sunset opener/i })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByDisplayValue("Sunset opener"), { target: { value: "Edited sunset opener" } });
    fireEvent.change(within(dialog).getByDisplayValue("Hold for local act"), { target: { value: "Confirmed for local act" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(upsertItem.mutate).toHaveBeenCalled());
    expect(upsertItem.mutate.mock.calls[0][0]).toMatchObject({
      editionId: "edition-1",
      revisionId: "revision-1",
      expectedVersion: 2,
      item: {
        id: "slot-1",
        title: "Edited sunset opener",
        itemType: "performance_slot",
        stageId: "stage-main",
        festivalDate: "2030-06-01",
        internalNotes: "Confirmed for local act",
        durationMinutes: 45,
        startsAt: "2030-06-01T18:00:00.000Z",
        endsAt: "2030-06-01T18:45:00.000Z",
      },
    });
  });
  it("clears the selected day and open inspector when switching editions", async () => {
    const original = structuredClone(workspace);
    const { rerender } = render(<FestivalScheduleWorkspace editionId="edition-1" />);
    fireEvent.mouseDown(screen.getByRole("tab"), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getAllByRole("button", { name: /Sunset opener/i })[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    try {
      workspace.edition = { id: "edition-2", title: "Next festival" };
      workspace.festivalDates = ["2030-07-02"];
      workspace.scheduleItems = [{ ...original.scheduleItems[0], id: "next-slot", edition_id: "edition-2", festival_date: "2030-07-02", title: "Next festival opener" }];
      rerender(<FestivalScheduleWorkspace editionId="edition-2" />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /Next festival opener/i }).length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: /Sunset opener/i })).not.toBeInTheDocument();
    } finally { Object.assign(workspace, original); }
  });

  it("blocks duplicate submissions and preserves the request key after an uncertain failure", async () => {
    render(<FestivalScheduleWorkspace editionId="edition-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Manual slot/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    const [first, callbacks] = upsertItem.mutate.mock.calls[0];
    expect(within(dialog).getByRole("button", { name: "Saving…" })).toBeDisabled();
    fireEvent.submit(dialog.querySelector("form")!);
    expect(upsertItem.mutate).toHaveBeenCalledTimes(1);
    act(() => { callbacks.onError(new Error("Lost response")); callbacks.onSettled(); });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Check the schedule before retrying");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    expect(upsertItem.mutate).toHaveBeenCalledTimes(2);
    expect(upsertItem.mutate.mock.calls[1][0]).toEqual(first);
  });

  it("uses a new request key after confirmed success", async () => {
    render(<FestivalScheduleWorkspace editionId="edition-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Manual slot/i }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Create" }));
    const [first, callbacks] = upsertItem.mutate.mock.calls[0];
    act(() => { callbacks.onSuccess({}); callbacks.onSettled(); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Manual slot/i }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Create" }));
    expect(upsertItem.mutate.mock.calls[1][0].idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it("does not open manual creation without an editable draft", () => {
    const draft = workspace.draftRevision;
    try {
      workspace.draftRevision = null as unknown as typeof draft;
      render(<FestivalScheduleWorkspace editionId="edition-1" />);
      expect(screen.getByRole("button", { name: /Manual slot/i })).toBeDisabled();
    } finally { workspace.draftRevision = draft; }
  });

});
