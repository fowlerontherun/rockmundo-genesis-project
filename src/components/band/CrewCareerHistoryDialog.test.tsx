import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CrewCareerHistoryDialog } from "./CrewCareerHistoryDialog";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock("@/components/gig/crewDb", () => ({
  crewDb: { from: mockFrom },
}));

const worker = {
  id: "crew-1",
  name: "Sound Engineer",
  crew_type: "Front of House Engineer",
  career_xp: 120,
  skill_level: 76,
  gigs_together: 8,
};

function renderCareer() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CrewCareerHistoryDialog crew={worker} onClose={() => undefined} />
    </QueryClientProvider>,
  );
}

describe("Crew career history", () => {
  beforeEach(() => mockFrom.mockReset());

  it("explains when an employee has not yet worked a verified gig", async () => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => Promise.resolve({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(query);
    renderCareer();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(await screen.findByText(/No completed gigs recorded yet/)).toBeInTheDocument();
    expect(mockFrom).toHaveBeenCalledWith("gig_crew_settlements");
  });

  it("shows credited XP, wages and skill improvement from the ledger", async () => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => Promise.resolve({
        data: [{
          id: "reward-1", settled_at: "2026-09-25T18:00:00Z",
          crew_role: "Front of House Engineer", salary_paid: 175,
          xp_awarded: 20, skill_before: 75, skill_after: 76,
          cohesion_before: 4, cohesion_after: 7,
        }],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(query);
    renderCareer();
    expect(await screen.findByText("+20 XP")).toBeInTheDocument();
    expect(screen.getByText(/Pay: \$175/)).toBeInTheDocument();
    expect(screen.getByText(/Skill: 75/)).toBeInTheDocument();
  });
});
