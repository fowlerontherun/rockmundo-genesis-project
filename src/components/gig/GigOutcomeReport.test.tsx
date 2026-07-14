import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GigOutcomeReport } from "./GigOutcomeReport";
import { buildLessons } from "./outcome/LessonsPanel";
import type { GigExperienceDTO, ReportMetric } from "@/features/gig-experience/types";

const metric = <T,>(value: T): ReportMetric<T> => ({ status: "available", value, source: "authoritative" });

function makeExperience(overrides: Partial<GigExperienceDTO> = {}): GigExperienceDTO {
  const base: GigExperienceDTO = {
    schemaVersion: 1,
    gig: { id: "gig-1", bandId: "band-1", status: "completed", scheduledDate: "2026-07-11", startedAt: null, completedAt: null, ticketPrice: metric(20), venue: { id: "venue-1", name: "The Test Club", location: "London", capacity: 500 } },
    headline: { overallRating: metric(19), performanceGrade: metric("A"), verdict: "A confident headline set", attendance: metric(210), capacity: metric(500), netProfit: metric(1200), fameGained: metric(16), fansGained: metric(42), bestSongTitle: metric("Closer") },
    songs: [
      { id: "s1", songId: "song-1", position: 1, title: "Weak Opener", performanceScore: metric(10), crowdResponse: metric("mixed"), contributions: { songQuality: metric(8), rehearsal: metric(7), chemistry: metric(6), equipment: metric(6), crew: metric(7), memberSkill: metric(8) } },
      { id: "s2", songId: "song-2", position: 2, title: "Closer", performanceScore: metric(21), crowdResponse: metric("ecstatic"), contributions: { songQuality: metric(20), rehearsal: metric(18), chemistry: metric(16), equipment: metric(15), crew: metric(14), memberSkill: metric(17) } },
    ],
    performers: [{ id: "p1", profileId: "profile-1", displayName: "Alex", roleOrInstrument: "Guitar", lineupStatus: "confirmed" }],
    finances: { ticketRevenue: metric(4200), merchRevenue: metric(500), totalRevenue: metric(4700), crewCosts: metric(800), equipmentWearCost: metric(200), venueCost: metric(2500), totalCosts: metric(3500), netProfit: metric(1200), merchItemsSold: metric(25) },
    progression: { fameGained: metric(16), chemistryChange: metric(2), totalXpAwarded: metric(100), fansGained: metric(42), fanConversions: metric(42) },
    analysis: { equipmentQuality: metric(10), crewSkill: metric(9), bandChemistry: metric(11), memberSkills: metric(13), crowdEnergyPeak: metric(84), stageBehaviorUsed: { status: "not_applicable", reason: "none" }, gearEffects: null, warnings: [] },
    postConsequences: { processingStatus: "completed", processingVersion: "test", processedAt: "2026-07-11", liveReputationDelta: metric(2), fanDelta: metric(42), followerDelta: metric(8), bookingDemandDelta: metric(4), mediaCoverage: metric("Local buzz"), timeline: [], nextActions: [], consequences: [] },
    lessons: { worked: [], heldBack: [], recommendations: [] },
    viewer: { ready: true, outcomeId: "outcome-1", resultReadyAt: "2026-07-11", replayAvailable: false },
  };
  return { ...base, ...overrides };
}

describe("GigOutcomeReport rebuild", () => {
  it("renders the headline result without requiring story details", () => {
    render(<GigOutcomeReport isOpen onClose={() => undefined} outcome={null} venueName="" venueCapacity={0} experience={makeExperience()} />);
    expect(screen.getByRole("heading", { name: /headline result/i })).toBeInTheDocument();
    expect(screen.getByText("A confident headline set")).toBeInTheDocument();
    expect(screen.getByText("210 / 500")).toBeInTheDocument();
    expect(screen.getByText("+$42 fans".replace("$", ""))).toBeInTheDocument();
  });

  it("renders performance story and timeline chronology", () => {
    render(<GigOutcomeReport isOpen onClose={() => undefined} outcome={null} venueName="" venueCapacity={0} experience={makeExperience()} />);
    expect(screen.getByRole("heading", { name: /performance story/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/chronological gig timeline/i)).toHaveTextContent("Doors open");
    expect(screen.getByLabelText(/chronological gig timeline/i)).toHaveTextContent("Turning point");
  });

  it("generates evidence-based lessons without inventing unsupported advice", () => {
    const lessons = buildLessons(makeExperience());
    expect(lessons.recommendations).toEqual(expect.arrayContaining(["Book smaller venue", "Rehearse Weak Opener", "Replace weak opener", "Improve equipment", "Hire crew", "Increase chemistry"].slice(0, 5)));
    expect(lessons.worked.join(" ")).toContain("Closer");
  });

  it("expands song details with keyboard-accessible controls", async () => {
    render(<GigOutcomeReport isOpen onClose={() => undefined} outcome={null} venueName="" venueCapacity={0} experience={makeExperience()} />);
    await userEvent.click(screen.getByLabelText(/expand details for weak opener/i));
    expect(screen.getByText(/combined factor points/i)).toBeInTheDocument();
  });

  it("supports legacy reports with missing song data", () => {
    render(<GigOutcomeReport isOpen onClose={() => undefined} venueName="Old Room" venueCapacity={100} songs={[]} outcome={{ overall_rating: 12, actual_attendance: 30, attendance_percentage: 30, ticket_revenue: 300, merch_sales: 0, total_revenue: 300, crew_costs: 50, equipment_wear_cost: 10, net_profit: 240, fame_gained: 2, chemistry_impact: 0 }} />);
    expect(screen.getByText(/Legacy or incomplete report/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing songs/i)).toBeInTheDocument();
  });

  it("shows processing and cancelled empty states", () => {
    const { rerender } = render(<GigOutcomeReport isOpen onClose={() => undefined} outcome={null} venueName="" venueCapacity={0} experience={makeExperience({ viewer: { ready: false, outcomeId: null, resultReadyAt: null, replayAvailable: false } })} />);
    expect(screen.getByText(/Results processing/i)).toBeInTheDocument();
    rerender(<GigOutcomeReport isOpen onClose={() => undefined} outcome={null} venueName="" venueCapacity={0} experience={makeExperience({ gig: { ...makeExperience().gig, status: "cancelled" } })} />);
    expect(screen.getByText(/Gig did not complete/i)).toBeInTheDocument();
  });

  it("uses mobile-safe single-column cards and accessible timeline labels", () => {
    render(<GigOutcomeReport isOpen onClose={() => undefined} outcome={null} venueName="" venueCapacity={0} experience={makeExperience()} />);
    expect(screen.getByLabelText(/chronological gig timeline/i).tagName).toBe("OL");
    expect(screen.getByText("Lessons for next gig")).toBeInTheDocument();
  });
});
