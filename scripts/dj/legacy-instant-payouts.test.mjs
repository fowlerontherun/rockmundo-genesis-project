import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

function source(path) {
  return readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
}

test("retired instant DJ mutation cannot silently award browser-controlled cash or XP", () => {
  const hook = fileURLToPath(new URL("../../src/hooks/useDjPerformance.ts", import.meta.url));
  assert.equal(existsSync(hook), false, "Do not reintroduce the unsafe client payout hook");
  for (const path of ["src/pages/NightClubDetail.tsx", "src/components/city/CityNightClubsSection.tsx"]) {
    const content = source(path);
    assert.doesNotMatch(content, /useDjPerformance|performDjSetAsync|Queue for DJ Slot/);
    assert.doesNotMatch(content, /\.from\(["']player_dj_performances["']\)\.insert\(/);
  }
});

test("city DJ actions route to the club, rather than granting instant rewards", () => {
  const city = source("src/components/city/CityNightClubsSection.tsx");
  assert.match(city, /onClick=\{\(\) => navigate\(\`\/nightclub\/\$\{club\.id\}\`\)\}/);
  assert.match(city, /DJ Sets & Mixer/);
});

test("scheduled bookings remain release-gated while practice remains reward-free", () => {
  const club = source("src/pages/NightClubDetail.tsx");
  const booking = source("src/features/nightclub-dj/DjBookingPanel.tsx");
  assert.match(club, /VITE_DJ_SCHEDULED_BOOKINGS_ENABLED === "true"/);
  assert.match(club, /id="dj-bookings"/);
  assert.match(club, /<DjBookingPanel\s+profileId=\{profileId\}/);
  assert.match(club, /reward-free practice/);
  assert.match(booking, /const isEnabled = import\.meta\.env\.VITE_DJ_SCHEDULED_BOOKINGS_ENABLED === "true"/);
  assert.match(booking, /if \(!isEnabled\)/);
});

test("limited performance history must not pretend to be lifetime earnings", () => {
  const club = source("src/pages/NightClubDetail.tsx");
  assert.match(club, /\.limit\(10\)/);
  assert.match(club, /DJ Performance History \(last 10\)/);
  assert.match(club, /Recent earnings/);
});
