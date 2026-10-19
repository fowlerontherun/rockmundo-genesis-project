import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const gameEvents = fs.readFileSync(path.join(root, "src/hooks/useGameEventNotifications.ts"), "utf8");
const modeling = fs.readFileSync(path.join(root, "src/components/modeling/ModelingOffersPanel.tsx"), "utf8");

describe("game notification delivery and modeling read safety", () => {
  it("invalidates stale band ownership immediately when the active profile changes", () => {
    expect(gameEvents).toContain("userBandIdsRef.current = { profileId: profileId ?? null, ids: [] }");
    expect(gameEvents).toContain("if (cancelled || activeIdentityRef.current.userId !== user.id ||");
    expect(gameEvents).toContain("userBandIdsRef.current.profileId === profileId");
    expect(gameEvents).not.toContain("userBandIdsRef.current.includes(");
  });

  it("claims chart cooldown only after a durable notification ID is returned", () => {
    const chart = gameEvents.split("const chartChannel =")[1].split("channels.push(chartChannel)")[0];
    const deliveredAt = chart.indexOf("const deliveredId = await notify(");
    const recordedAt = chart.indexOf(".upsert({");
    expect(deliveredAt).toBeGreaterThan(0);
    expect(recordedAt).toBeGreaterThan(deliveredAt);
    expect(chart).toContain("if (!deliveredId || activeIdentityRef.current.profileId !== profileId) return;");
    expect(chart).toContain("chartInFlightRef.current.add(chartKey)");
    expect(chart).toContain("chartInFlightRef.current.delete(chartKey)");
  });

  it("never generates modeling offers until the pending offer query succeeds", () => {
    expect(modeling).toContain("if (!userId || !profileId || !offersLoaded || isLoading || isError || !pendingOffers) return;");
    expect(modeling).toContain("Unable to load modeling offers.");
    expect(modeling).toContain("refetchOffers()");
    expect(modeling).toContain("generateModelingOffersForUser(userId");
  });
});
