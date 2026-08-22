import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("src/mobile/pages/MobileWorldPhase5.tsx"), "utf8");
const travelSystem = fs.readFileSync(path.resolve("src/utils/travelSystem.ts"), "utf8");
const completeTravel = fs.readFileSync(path.resolve("supabase/functions/complete-travel/index.ts"), "utf8");

describe("Mobile World companion contract", () => {
  it("keeps only overview and travel as first-class mobile World flows", () => {
    expect(source).toContain('to="/mobile/world"');
    expect(source).toContain('to="/mobile/world/travel"');
    expect(source).toContain('if (section === "travel") return <TravelMobile />');
    expect(source).toContain('return <WorldOverviewMobile />');
  });

  it("gates deep World systems behind explicit desktop-only boundaries", () => {
    for (const section of ["venues", "companies", "jobs", "marketplace", "shops", "charts", "festivals", "events", "search", "city", "locations"]) {
      expect(source).toContain(`${section}:`);
    }
    expect(source).toContain("Desktop world gameplay");
    expect(source).toContain("remain desktop gameplay");
  });

  it("uses travel history as the authoritative booked/current journey source", () => {
    expect(source).toContain('queryKey: ["mobile-travel-state", profileId]');
    expect(source).toContain('.from("player_travel_history")');
    expect(source).toContain('.eq("profile_id", profileId)');
    expect(source).toContain('.in("status", ["scheduled", "in_progress"])');
    expect(source).toContain("effectiveStatus");
    expect(source).toContain("start <= now.getTime()");
    expect(source).toContain("travelFromHistory(record) ?? legacyCurrentTravel(activityStatus)");
  });

  it("refreshes GameData, My Day and travel state after a booking", () => {
    expect(source).toContain("refetch: refetchGameData");
    expect(source).toContain("refetchGameData()");
    expect(source).toContain('queryClient.invalidateQueries({ queryKey: ["mobile-travel-state"] })');
    expect(source).toContain('queryClient.invalidateQueries({ queryKey: ["mobile-day-schedule"] })');
    expect(source).toContain('queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] })');
  });

  it("blocks unsafe route planning when the current city is unavailable", () => {
    expect(source).toContain('title="Current city unavailable"');
    expect(source).toContain("A journey cannot be priced or booked safely until your current city is loaded.");
    expect(source).toContain("onRetry={() => refetchGameData()}");
    expect(source).toContain("fromCity && !hasTravelCommitment");
  });

  it("keeps one mobile journey at a time so future routes use a truthful origin", () => {
    expect(source).toContain("const hasTravelCommitment = travelling || scheduledTravel");
    expect(source).toContain('title="Travel already planned"');
    expect(source).toContain("Plan another trip after this journey finishes");
  });

  it("preserves the actual minute for on-demand private jet departures", () => {
    expect(source).toContain("export function travelDepartureInstant");
    expect(source).toContain('if (mode.toLowerCase() === "private_jet") return departure;');
    expect(source).toContain("travelDepartureInstant(departure.date, departure.hour, chosen.mode)");
  });

  it("does not fabricate a zero cash balance and preflights known insufficient funds", () => {
    expect(source).toContain('value == null ? "Unavailable"');
    expect(source).toContain("const insufficientFunds = !!chosen && funds != null && funds < chosen.cost");
    expect(source).toContain('insufficientFunds ? "Insufficient funds"');
    expect(source).not.toContain('profile as any)?.cash ?? 0');
  });

  it("reports future travel as booked rather than falsely completed", () => {
    expect(travelSystem).toContain("Future journeys are booked, not already completed");
    expect(travelSystem).toContain("`Booked travel from ${fromCityName} to ${toCityName} by ${transportType}`");
    expect(travelSystem).toContain("`Travel booked to ${toCityName}`");
    expect(travelSystem).toContain("newLocation: startsImmediately ? toCityName : null");
  });

  it("keeps the authoritative travel lifecycle and My Day schedule status aligned", () => {
    expect(completeTravel).toContain('.update({ status: "completed" })');
    expect(completeTravel).toContain('.eq("status", "in_progress")');
    expect(completeTravel).toContain('.update({ status: "in_progress" })');
    expect(completeTravel).toContain('.eq("status", "scheduled")');
    expect(completeTravel).toContain('.from("player_scheduled_activities")');
    expect(completeTravel).toContain('.contains("metadata", { travel_history_id: travel.id })');
    expect(completeTravel).toContain('profile_id: travel.profile_id ?? null');
  });
});
