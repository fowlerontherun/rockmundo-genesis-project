import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Awards from "../Awards";
import { vi } from "vitest";

const submitNomination = vi.fn();
const castVote = vi.fn();
const bookPerformance = vi.fn();
const attendRedCarpet = vi.fn();
const mockHasReachedVoteCap = vi.fn().mockReturnValue(false);

const shows = [
  {
    id: "show-nomination",
    show_name: "Indie Spotlight",
    year: 2025,
    venue: "Echo Arena",
    district: "North",
    overview: "Celebrating new talent",
    schedule: { nominationsClose: "Feb 1" },
    categories: [
      { name: "Best Song", description: "Top track" },
      { name: "Best Album", description: "Top album" },
    ],
    voting_breakdown: { overall_progress: 35, featured_nomination_id: "nom-1" },
    performance_slots: [],
    broadcast_partners: [],
    status: "nominations_open",
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "show-voting",
    show_name: "Global Sounds",
    year: 2024,
    venue: "Main Hall",
    district: "East",
    overview: "Voting in progress",
    schedule: { votingEnds: "Mar 1" },
    categories: [{ name: "Best Vocal", description: "Voice" }],
    voting_breakdown: { overall_progress: 65, featured_nomination_id: "nom-2" },
    performance_slots: [],
    broadcast_partners: [],
    status: "voting_open",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "show-completed",
    show_name: "Legends Gala",
    year: 2023,
    venue: "City Center",
    district: "West",
    overview: "Event completed",
    schedule: { ceremony: "Apr 1" },
    categories: [{ name: "Lifetime Achievement", description: "Legacy" }],
    voting_breakdown: { overall_progress: 100, featured_nomination_id: "nom-3" },
    performance_slots: [],
    broadcast_partners: [],
    status: "completed",
    created_at: "2023-01-01T00:00:00Z",
  },
];

const nominations = [
  {
    id: "nom-1",
    award_show_id: "show-nomination",
    category_name: "Best Song",
    nominee_type: "song",
    nominee_id: "song-1",
    nominee_name: "Shining Star",
    band_id: "band-1",
    user_id: "user-1",
    submission_data: {},
    status: "pending",
    vote_count: 4,
    created_at: "2025-01-02T00:00:00Z",
  },
  {
    id: "nom-2",
    award_show_id: "show-voting",
    category_name: "Best Vocal",
    nominee_type: "band",
    nominee_id: "band-1",
    nominee_name: "The Rockers",
    band_id: "band-1",
    user_id: "user-1",
    submission_data: {},
    status: "shortlisted",
    vote_count: 12,
    created_at: "2024-01-02T00:00:00Z",
  },
];

const wins = [
  {
    id: "win-1",
    award_show_id: "show-completed",
    category_name: "Lifetime Achievement",
    winner_name: "Legends United",
    band_id: "band-1",
    user_id: "user-1",
    fame_boost: 50,
    prize_money: 10000,
    won_at: "2023-02-01T00:00:00Z",
  },
];

vi.mock("@/hooks/useGameData", () => ({
  useGameData: () => ({ profile: { user_id: "user-1" } }),
}));

vi.mock("@/hooks/usePrimaryBand", () => ({
  usePrimaryBand: () => ({ data: { bands: { id: "band-1" } } }),
}));

vi.mock("@/hooks/useAwards", () => ({
  useAwards: () => ({
    shows,
    showsLoading: false,
    nominations,
    nominationsLoading: false,
    wins,
    winsLoading: false,
    submitNomination,
    castVote,
    bookPerformance,
    attendRedCarpet,
    isSubmitting: false,
    isVoting: false,
    isBooking: false,
    isAttending: false,
  }),
}));

vi.mock("@/utils/voteCap", () => ({
  hasReachedVoteCap: (...args: unknown[]) => mockHasReachedVoteCap(...args),
}));

describe("Awards", () => {
  beforeEach(() => {
    submitNomination.mockClear();
    castVote.mockClear();
    bookPerformance.mockClear();
    attendRedCarpet.mockClear();
    mockHasReachedVoteCap.mockReset();
    mockHasReachedVoteCap.mockReturnValue(false);
  });

  it("renders status badges and progress for each award show", async () => {
    render(<Awards />);

    expect(screen.getByText(/nominations open/i)).toBeInTheDocument();
    expect(screen.getByText(/voting open/i)).toBeInTheDocument();
    expect(screen.getByText(/completed/i)).toBeInTheDocument();

    expect(screen.getByText(/35%/)).toBeInTheDocument();
    expect(screen.getByText(/65%/)).toBeInTheDocument();
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it("prevents nomination submission until required fields are filled", async () => {
    const user = userEvent.setup();
    render(<Awards />);

    await user.click(screen.getByRole("button", { name: /submit nomination/i }));
    const dialog = await screen.findByRole("dialog");

    const submitButton = within(dialog).getByRole("button", { name: /^submit nomination$/i });
    expect(submitButton).toBeDisabled();

    await user.click(within(dialog).getByText(/select category/i));
    await user.click(screen.getByText("Best Song"));

    const nomineeInput = within(dialog).getByPlaceholderText(/enter name of song/i);
    await user.type(nomineeInput, "Skyline Anthem");

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(submitNomination).toHaveBeenCalledWith({
      award_show_id: "show-nomination",
      category_name: "Best Song",
      nominee_type: "song",
      nominee_id: "Skyline Anthem",
      nominee_name: "Skyline Anthem",
      band_id: "band-1",
      submission_data: { notes: "" },
    });
  });

  it("disables voting when outside the voting window or when caps are reached", async () => {
    const user = userEvent.setup();
    render(<Awards />);

    const nominationVote = screen.getByTestId("vote-button-show-nomination");
    const votingVote = screen.getByTestId("vote-button-show-voting");
    const completedVote = screen.getByTestId("vote-button-show-completed");

    expect(nominationVote).toBeDisabled();
    expect(completedVote).toBeDisabled();
    expect(votingVote).toBeEnabled();

    await user.click(votingVote);
    expect(castVote).toHaveBeenCalledWith({ nomination_id: "nom-2" });

    mockHasReachedVoteCap.mockReturnValue(true);
    render(<Awards />);

    expect(screen.getByTestId("vote-button-show-voting")).toBeDisabled();
  });
});
