import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const page = read("../../../pages/PlayerDiscovery.tsx");
const service = read("../services/playerDiscovery.ts");

describe("player discovery usability and fail-closed result batch", () => {
  it("#4090 clamps nonfinite pagination before submitting the request", () => {
    expect(service).toContain('!Number.isFinite(value)');
    expect(service).toContain('MAX_DISCOVERY_PAGE = 100_000');
    expect(service).toContain('finitePageNumber(query.pageSize, DEFAULT_DISCOVERY_PAGE_SIZE');
    expect(service).toContain('finitePageNumber(query.page, 1, MAX_DISCOVERY_PAGE)');
  });

  it("#4091 rejects broken RPC payloads rather than showing zero results", () => {
    expect(service).toContain('!Array.isArray(data.results)');
    expect(service).toContain('typeof data.has_more !== "boolean"');
    expect(service).toContain('throw new Error("Player discovery returned an invalid result.');
  });

  it("#4092 hides cached results and next-page links after verification fails", () => {
    expect(page).toContain('!discovery.isError && !discovery.isLoading && (');
    expect(page).toContain('!discovery.isError && !discovery.isLoading && discovery.data &&');
    expect(page).not.toContain('{discovery.data?.hasMore && <div');
  });

  it("#4093 stores boolean availability filters with independent toggle controls", () => {
    expect(page).toContain('const toggleAvailability = (key: typeof availabilityKeys[number])');
    expect(page).toContain('[key]: !current[key]');
    expect(page).toContain('aria-pressed={Boolean(filters[key])}');
    expect(page).not.toContain('setFilter(v as keyof PlayerDiscoveryFilters, "true")');
  });

  it("#4094 resets to first page when sorting and supports backwards paging", () => {
    expect(page).toContain('setSort(v as DiscoverySort); setPage(1);');
    expect(page).toContain('onClick={() => setPage((current) => Math.max(1, current - 1))}');
    expect(page).toContain('Page {page}');
  });

  it("#4095 exposes explicit keyboard and button search submission", () => {
    expect(page).toContain('const submitSearch = () => { setDebouncedSearch(search); setPage(1); };');
    expect(page).toContain('aria-label="Search" onClick={submitSearch}');
    expect(page).toContain('if (e.key === "Enter") submitSearch()');
  });
});
