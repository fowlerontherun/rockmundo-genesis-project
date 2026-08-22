import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const home = fs.readFileSync(path.resolve("src/mobile/pages/MobileHome.tsx"), "utf8");
const book = fs.readFileSync(path.resolve("src/mobile/components/MobileBook.tsx"), "utf8");
const outcomes = fs.readFileSync(path.resolve("src/mobile/components/MobileOutcomes.tsx"), "utf8");
const booking = fs.readFileSync(path.resolve("src/hooks/useActivityBooking.ts"), "utf8");
const stipend = fs.readFileSync(path.resolve("src/components/attributes/DailyStipendCard.tsx"), "utf8");
const topBar = fs.readFileSync(path.resolve("src/mobile/shell/TopAppBar.tsx"), "utf8");
const scheduledProcessor = fs.readFileSync(path.resolve("supabase/functions/process-scheduled-activities/index.ts"), "utf8");

describe("mobile daily loop", () => {
  it("makes booking and outcomes first-class mobile home views", () => {
    expect(home).toContain('requestedView === "book"');
    expect(home).toContain('requestedView === "outcomes"');
    expect(home).toContain('<MobileBook profileId={profileId}');
    expect(home).toContain('<MobileOutcomes userId={userId} profileId={profileId}');
    expect(home).toContain('label: "Book"');
    expect(home).toContain('label: "Outcomes"');
    expect(topBar).toContain('if (view === "book") return "Book Activity"');
    expect(topBar).toContain('if (view === "outcomes") return "Outcomes"');
  });

  it("uses the canonical desktop stipend claim path on mobile", () => {
    expect(home).toContain('import { DailyStipendCard } from "@/components/attributes/DailyStipendCard"');
    expect(home).toContain('<DailyStipendCard lastClaimDate={lastStipendClaim}');
    expect(home).toContain('stipend_claim_streak');
    expect(home).toContain('last_stipend_claim_date');
    expect(stipend).toContain('mutationFn: claimDailyXp');
    expect(stipend).toContain('Claim Daily Stipend');
  });

  it("keeps mobile booking lightweight while creating real scheduled recovery", () => {
    expect(book).toContain('title="Practice"');
    expect(book).toContain('title="Travel"');
    expect(book).toContain('title="Wellness"');
    expect(book).toContain('activityType: "health"');
    expect(book).toContain('title: "Recovery time"');
    expect(book).toContain('navigate("/mobile?view=day")');
    expect(book).toContain('Detailed gig, recording, rehearsal, release and band-management configuration remains desktop-only');
  });

  it("resolves the active character canonically for shared scheduled bookings", () => {
    expect(booking).toContain('import { getActiveProfile } from "@/services/profileService"');
    expect(booking).toContain('const profileData = await getActiveProfile(userId)');
    expect(booking).not.toContain(".eq('is_active', true)\n    .is('died_at', null)\n    .maybeSingle()");
  });

  it("completes scheduled recovery against the exact booked character", () => {
    expect(scheduledProcessor).toContain("case 'health':");
    expect(scheduledProcessor).toContain(".eq('id', activity.profile_id)");
    expect(scheduledProcessor).not.toContain(".eq('user_id', activity.user_id)\n        .single()");
  });

  it("shows authoritative completed schedule items and activity-feed rewards", () => {
    expect(outcomes).toContain('useMobileDaySchedule(new Date(), userId, profileId)');
    expect(outcomes).toContain('activity.status === "completed"');
    expect(outcomes).toContain('title="Results & rewards"');
    expect(outcomes).toContain('activity.earnings');
    expect(outcomes).toContain('recentResults = activities.slice(0, 20)');
  });
});
