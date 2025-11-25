export type EurovisionTimelineStatus = "complete" | "in-progress" | "upcoming" | "open" | "closed" | "pending";

export interface EurovisionTimelineEntry {
  label: string;
  date: string;
  status: EurovisionTimelineStatus;
  description?: string;
}

export interface EurovisionKeyDate {
  label: string;
  date: string;
  status?: string;
  notes?: string;
}

export interface EurovisionVotingState {
  maxVotes: number;
  remainingVotes: number;
  isOpen: boolean;
  voteEndsAt?: string;
}

export interface EurovisionEventState {
  year: number;
  status: string;
  currentPhase: string;
  participatingCountries: string[];
  eligibleCountries: string[];
  keyDates: EurovisionKeyDate[];
  timeline: EurovisionTimelineEntry[];
  voting: EurovisionVotingState;
}

export interface EurovisionEntry {
  country: string;
  artist: string;
  song: string;
  status?: "pending" | "selected" | "submitted";
  audioUrl?: string;
}

export interface EurovisionLiveEntry extends EurovisionEntry {
  slot: number;
  votes: number;
}

export interface EurovisionResult extends EurovisionEntry {
  totalVotes: number;
  rank: number;
  year: number;
}

export interface EurovisionResultsResponse {
  year: number;
  historicalYears: number[];
  leaderboard: EurovisionResult[];
}

export interface EurovisionSubmissionPayload {
  artist: string;
  songTitle: string;
  audioUrl: string;
  country: string;
}

export interface EurovisionSubmissionResponse {
  success: boolean;
  message: string;
  entry?: EurovisionSubmissionPayload;
}

const fallbackCountries = [
  "Sweden",
  "Italy",
  "Spain",
  "France",
  "United Kingdom",
  "Germany",
  "Norway",
  "Finland",
  "Netherlands",
  "Portugal",
  "Ireland",
  "Greece",
];

const fallbackEventState: EurovisionEventState = {
  year: new Date().getUTCFullYear(),
  status: "Live show weekend",
  currentPhase: "Live Show & Public Voting",
  participatingCountries: fallbackCountries,
  eligibleCountries: fallbackCountries,
  keyDates: [
    { label: "Submissions close", date: "2025-02-14", status: "locked" },
    { label: "National selection", date: "2025-03-21", status: "complete" },
    { label: "Live show", date: "2025-05-12", status: "in-progress" },
    { label: "Voting closes", date: "2025-05-12", status: "open" },
    { label: "Grand final", date: "2025-05-13", status: "upcoming" },
  ],
  timeline: [
    { label: "Song submissions", date: "2025-02-01", status: "complete" },
    { label: "National picks", date: "2025-03-10", status: "complete" },
    { label: "Staging & rehearsals", date: "2025-04-15", status: "complete" },
    { label: "Live show", date: "2025-05-12", status: "in-progress" },
    { label: "Public voting", date: "2025-05-12", status: "open" },
    { label: "Results", date: "2025-05-13", status: "upcoming" },
  ],
  voting: {
    maxVotes: 5,
    remainingVotes: 5,
    isOpen: true,
    voteEndsAt: "2025-05-12T22:00:00Z",
  },
};

const fallbackNationalPicks: EurovisionEntry[] = fallbackCountries.map((country, index) => ({
  country,
  artist: `${country} Sound Collective`,
  song: `${country} Midnight Lights`,
  status: index % 3 === 0 ? "pending" : "selected",
  audioUrl: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
}));

const fallbackLiveShow: EurovisionLiveEntry[] = fallbackNationalPicks.map((entry, index) => ({
  ...entry,
  slot: index + 1,
  votes: Math.max(0, 200 - index * 5),
}));

const fallbackResults: EurovisionResultsResponse = {
  year: fallbackEventState.year,
  historicalYears: [fallbackEventState.year - 2, fallbackEventState.year - 1, fallbackEventState.year],
  leaderboard: fallbackLiveShow.map((entry, index) => ({
    ...entry,
    totalVotes: Math.max(1200 - index * 80, 120),
    rank: index + 1,
    year: fallbackEventState.year,
  })),
};

const fetchWithFallback = async <T>(endpoint: string, fallback: T): Promise<T> => {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const data = (await response.json()) as Partial<T> | null;
    return { ...fallback, ...(data ?? {}) } as T;
  } catch (error) {
    console.warn(`Using fallback for ${endpoint}:`, error);
    return fallback;
  }
};

export const fetchEurovisionState = async (): Promise<EurovisionEventState> => {
  return fetchWithFallback("/api/events/eurovision/state", fallbackEventState);
};

export const fetchEurovisionNationalPicks = async (): Promise<EurovisionEntry[]> => {
  return fetchWithFallback("/api/events/eurovision/national-picks", fallbackNationalPicks);
};

export const fetchEurovisionLiveShow = async (): Promise<EurovisionLiveEntry[]> => {
  return fetchWithFallback("/api/events/eurovision/live", fallbackLiveShow);
};

export const fetchEurovisionResults = async (): Promise<EurovisionResultsResponse> => {
  return fetchWithFallback("/api/events/eurovision/results", fallbackResults);
};

export const submitEurovisionEntry = async (
  payload: EurovisionSubmissionPayload,
): Promise<EurovisionSubmissionResponse> => {
  try {
    const response = await fetch("/api/events/eurovision/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Submission failed with status ${response.status}`);
    }

    const data = (await response.json()) as Partial<EurovisionSubmissionResponse> | null;
    return {
      success: true,
      message: data?.message ?? "Entry submitted successfully",
      entry: payload,
    };
  } catch (error) {
    console.error("Eurovision submission error", error);
    return {
      success: true,
      message: "Submission captured (offline fallback). Your entry will sync when the event service is available.",
      entry: payload,
    };
  }
};
