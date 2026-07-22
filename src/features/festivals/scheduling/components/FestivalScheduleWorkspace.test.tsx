import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScheduleWorkspace } from "./FestivalScheduleWorkspace";

const upsertItem = { mutate: vi.fn() };
const publish = { isPending: false, mutate: vi.fn() };
const previewTemplate = { mutate: vi.fn() };
const applyTemplate = { mutate: vi.fn() };

const workspace = {
  festival: { id: "festival-1", name: "Owner Fest" },
  edition: { id: "edition-1", title: "Owner Fest 2030" },
  timeZone: "Europe/London",
  festivalDates: ["2030-06-01"],
  scheduleState: "draft",
  draftRevision: { id: "revision-1", revision_number: 3 },
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
    publish,
    previewTemplate,
    applyTemplate,
    configureHours: { mutate: vi.fn() },
    lock: { mutate: vi.fn() },
    reopen: { mutate: vi.fn() },
    discardDraft: { mutate: vi.fn() },
  }),
}));

afterEach(() => {
  upsertItem.mutate.mockClear();
  publish.mutate.mockClear();
  previewTemplate.mutate.mockClear();
  applyTemplate.mutate.mockClear();
});

describe("FestivalScheduleWorkspace owner slot management", () => {
  it("shows the stage schedule timeline with existing festival slots", () => {
    render(<FestivalScheduleWorkspace editionId="edition-1" />);

    expect(screen.getByRole("heading", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByText("Main Stage")).toBeInTheDocument();
    expect(screen.getByText("Second Stage")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sunset opener/i })).toBeInTheDocument();
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
        startsAt: "2030-06-01T21:30:00",
        durationMinutes: 75,
        publicVisible: true,
      },
    });
  });

  it("edits an existing festival slot from the schedule inspector", async () => {
    render(<FestivalScheduleWorkspace editionId="edition-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Sunset opener/i }));
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
      },
    });
  });
});
