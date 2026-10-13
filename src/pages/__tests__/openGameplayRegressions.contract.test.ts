import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../../", import.meta.url);
const source = (path: string) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");

describe("regressions: scheduling, inventory, tours and songs", () => {
  it("#3206 fails closed when band availability query fails", () => {
    const code = source("src/utils/bandActivityScheduling.ts");
    const block = code.slice(code.indexOf("export async function checkBandAvailability("), code.indexOf("export function formatConflictLine("));
    expect(block).toMatch(/const \{ data: overlapping, error \} = await query;\s*if \(error\) \{\s*throw new Error/);
    expect(block).not.toMatch(/allowing booking/);
  });

  it("#3085 gives failed instrument queries their own retry state", () => {
    const code = source("src/pages/InventoryManager.tsx");
    expect(code).toMatch(/isError: gearError, refetch: retryGear/);
    expect(code).toMatch(/gearError\s*\?[^:]*Unable to load instruments[\s\S]*?retryGear\(\)/);
  });

  it("#2697 gives property-key errors a retry state rather than an empty list", () => {
    const code = source("src/pages/InventoryManager.tsx");
    expect(code).toMatch(/isError: propertiesError, refetch: retryProperties/);
    expect(code).toMatch(/propertiesError\s*\?[^:]*Unable to load property keys[\s\S]*?retryProperties\(\)/);
  });

  it("#3080 keeps real zero ticket revenue instead of substituting gig payment", () => {
    const code = source("src/pages/TourManager.tsx");
    expect(code).toContain("gig_revenue: outcome?.ticket_revenue ?? gig?.payment ?? null");
    expect(code).not.toMatch(/gig_revenue:\s*outcome\?\.ticket_revenue\s*\|\|/);
  });

  it("#2694 separates failed song fetching from the empty catalogue state", () => {
    const code = source("src/pages/SongManager.tsx");
    expect(code).toMatch(/isError, refetch/);
    expect(code).toMatch(/isError\s*\?\s*\(<Card role="alert"[\s\S]*?Retry songs[\s\S]*?filteredSongs\.length === 0/);
  });
});
