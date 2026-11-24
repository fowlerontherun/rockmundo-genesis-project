import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
const hub = read("../components/CanonicalPlayerFestivalHub.tsx");
const application = read("../components/FestivalApplicationDialog.tsx");
const invitations = read("../components/FestivalDirectInvitations.tsx");
const directory = read("../../../festival-company/ui/PublicFestivalDirectory.tsx");

describe("festival hub failure states and mobile navigation", () => {
  it("does not render successful empty responses when bookings failed", () => {
    for (const label of ["festivals", "applications", "offers", "contracts"]) {
      expect(hub).toContain(`label="${label}"`);
    }
    expect(hub).toContain("This does not mean there are no records.");
    expect(hub).toContain("Retry {label}");
  });

  it("blocks an application until existing records were checked", () => {
    expect(application).toContain("applicationsQuery.isPending");
    expect(application).toContain("applicationsQuery.isError");
    expect(application).toContain("Retry application check");
  });

  it("offers retries for invitation and public directory errors", () => {
    expect(invitations).toContain("Retry invitations");
    expect(directory).toContain("Retry festival directory");
    expect(directory).toContain("!isLoading && !isError && data.map");
  });

  it("offers keyboard-scrollable mobile artist navigation and visitor entry", () => {
    expect(hub).toContain('aria-label="Festival artist navigation" tabIndex={0}');
    expect(hub).toContain("overflow-x-auto");
    expect(hub).toContain("min-h-11 shrink-0");
    expect(hub).toContain("festivalRoutes.publicDirectory()");
  });
});
