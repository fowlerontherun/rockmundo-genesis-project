export type EurovisionPhase =
  | "SubmissionsOpen"
  | "SelectionsDone"
  | "EventLive"
  | "VotingClosed"
  | "Results";

export interface Country {
  code: string;
  name: string;
  eligible: boolean;
  submissionStatus: "Open" | "Closed";
  lastSubmittedAt?: string | null;
}

export interface ArtistSubmission {
  id: string;
  year: number;
  countryCode: string;
  artistName: string;
  songTitle: string;
  submittedBy: string;
  status: "Pending" | "Selected" | "Rejected";
  submittedAt: string;
}

export interface SelectedEntry {
  id: string;
  submissionId: string;
  countryCode: string;
  artistName: string;
  songTitle: string;
  runningOrder?: number | null;
  selectionMethod: "Random";
  voteCount: number;
  pointsTotal: number;
}

export interface Vote {
  id: string;
  year: number;
  voterId: string;
  entryId: string;
  points: number;
  castAt: string;
}

export interface EurovisionYear {
  year: number;
  phase: EurovisionPhase;
  submissionWindowOpen: boolean;
  selectionCompletedAt?: string | null;
  eventStartedAt?: string | null;
  runningOrder: SelectedEntry[];
  maxVotesPerPlayer: number;
  tally?: Record<
    string,
    {
      voteCount: number;
      points: number;
    }
  >;
}
