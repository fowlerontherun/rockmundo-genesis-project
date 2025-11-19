import { nanoid } from "nanoid";
import type { AwardNomination, AwardShow, AwardWin } from "@/hooks/useAwards";

type AwardsLifecyclePhase = "submissions" | "selection" | "event_live" | "voting" | "results";

type MockSubscription = (state: MockAwardsState) => void;

interface MockAwardsState {
  phase: AwardsLifecyclePhase;
  shows: AwardShow[];
  nominations: AwardNomination[];
  wins: AwardWin[];
  votesByUser: Record<string, number>;
}

const initialShow: AwardShow = {
  id: "global-awards",
  show_name: "Rockmundo Global Awards",
  year: 2024,
  venue: "Rockmundo Arena",
  district: "Downtown",
  overview: "Celebrating bands across the world with a focus on fairness and reach.",
  schedule: {
    submissions: "Open",
    selection: "Jury",
    event_live: "Streaming",
    voting: "Fans",
    results: "Ceremony",
  },
  categories: [
    { name: "Best Song", description: "Recognizing songwriting and performance." },
    { name: "Best Live Act", description: "Honoring unforgettable stage presence." },
  ],
  voting_breakdown: {},
  rewards: {},
  performance_slots: [],
  broadcast_partners: ["Rockmundo TV"],
  status: "nominations_open",
  created_at: new Date().toISOString(),
};

const phaseStatusMap: Record<AwardsLifecyclePhase, AwardShow["status"]> = {
  submissions: "nominations_open",
  selection: "upcoming",
  event_live: "upcoming",
  voting: "voting_open",
  results: "completed",
};

class AwardsMockServer {
  private state: MockAwardsState = {
    phase: "submissions",
    shows: [initialShow],
    nominations: [],
    wins: [],
    votesByUser: {},
  };

  private listeners = new Set<MockSubscription>();

  subscribe(listener: MockSubscription) {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  get phase() {
    return this.state.phase;
  }

  snapshot(): MockAwardsState {
    return {
      phase: this.state.phase,
      shows: [...this.state.shows],
      nominations: [...this.state.nominations],
      wins: [...this.state.wins],
      votesByUser: { ...this.state.votesByUser },
    };
  }

  reset() {
    this.state = {
      phase: "submissions",
      shows: [initialShow],
      nominations: [],
      wins: [],
      votesByUser: {},
    };
    this.notify();
  }

  submitNomination(nomination: Omit<AwardNomination, "id" | "status" | "vote_count" | "created_at">) {
    if (this.state.phase !== "submissions") {
      throw new Error("Submissions are closed");
    }

    const newNomination: AwardNomination = {
      ...nomination,
      id: nanoid(),
      status: "pending",
      vote_count: 0,
      created_at: new Date().toISOString(),
    };

    this.state.nominations = [newNomination, ...this.state.nominations];
    this.notify();
    return newNomination;
  }

  getShows() {
    return this.state.shows.map((show) => ({
      ...show,
      status: phaseStatusMap[this.state.phase],
    }));
  }

  getNominations(filters: Partial<Record<keyof AwardNomination, string>>) {
    return this.state.nominations.filter((nomination) => {
      return Object.entries(filters).every(([key, value]) => {
        return value ? (nomination as any)[key] === value : true;
      });
    });
  }

  getWins(filters: Partial<Record<keyof AwardWin, string>>) {
    return this.state.wins.filter((win) => {
      return Object.entries(filters).every(([key, value]) => {
        return value ? (win as any)[key] === value : true;
      });
    });
  }

  getFinalistsByCountry() {
    return this.state.nominations
      .filter((nomination) => nomination.status === "shortlisted" || nomination.status === "winner")
      .reduce<Record<string, AwardNomination>>((acc, nomination) => {
        const country = nomination.submission_data?.country || "Unknown";
        if (!acc[country]) {
          acc[country] = nomination;
        }
        return acc;
      }, {});
  }

  selectRandomFinalists() {
    const finalists: AwardNomination[] = [];
    const seenCountries = new Set<string>();

    for (const nomination of [...this.state.nominations].reverse()) {
      const country = nomination.submission_data?.country || "Unknown";
      if (!seenCountries.has(country)) {
        seenCountries.add(country);
        finalists.push({ ...nomination, status: "shortlisted" });
      }
    }

    this.state.nominations = this.state.nominations.map((nomination) => {
      const selected = finalists.find((item) => item.id === nomination.id);
      return selected ? selected : nomination;
    });

    this.notify();
    return finalists;
  }

  castVote(nominationId: string, userId: string) {
    if (this.state.phase !== "voting") {
      throw new Error("Voting is not open");
    }

    const votesUsed = this.state.votesByUser[userId] || 0;
    if (votesUsed >= 3) {
      throw new Error("Vote limit reached");
    }

    const nominationIndex = this.state.nominations.findIndex((nom) => nom.id === nominationId);
    if (nominationIndex === -1) {
      throw new Error("Nomination not found");
    }

    const updated = {
      ...this.state.nominations[nominationIndex],
      vote_count: this.state.nominations[nominationIndex].vote_count + 1,
    };

    this.state.nominations[nominationIndex] = updated;
    this.state.votesByUser[userId] = votesUsed + 1;
    this.notify();
    return updated;
  }

  advancePhase(nextPhase: AwardsLifecyclePhase) {
    this.state.phase = nextPhase;

    if (nextPhase === "results") {
      this.generateResults();
    }

    this.notify();
    return this.state.phase;
  }

  private generateResults() {
    const finalists = this.getFinalistsByCountry();
    const wins: AwardWin[] = Object.values(finalists).map((nomination) => ({
      id: nanoid(),
      award_show_id: nomination.award_show_id,
      category_name: nomination.category_name,
      winner_name: nomination.nominee_name,
      band_id: nomination.band_id,
      user_id: nomination.user_id,
      fame_boost: 100,
      prize_money: 5000,
      won_at: new Date().toISOString(),
    }));

    this.state.wins = wins;
    this.state.nominations = this.state.nominations.map((nomination) => {
      const winner = wins.find((win) => win.category_name === nomination.category_name);
      return winner && winner.winner_name === nomination.nominee_name
        ? { ...nomination, status: "winner" }
        : nomination;
    });
  }

  private notify() {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
    (globalThis as any).__awardsMockApi = {
      advancePhase: this.advancePhase.bind(this),
      selectFinalists: this.selectRandomFinalists.bind(this),
      reset: this.reset.bind(this),
      getState: () => this.snapshot(),
    };
  }
}

export const awardsMockServer = new AwardsMockServer();
