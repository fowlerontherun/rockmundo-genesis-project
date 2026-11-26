import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import type { FestivalPlayerAttendance } from "../attendance/festivalAttendance";
import type { FestivalMemorabiliaItem } from "../attendance/festivalAttendeeExtras";
import { parsePublicFestivalWithIdentity } from "../domain/festivalLaunch";
import { attendanceForPublicFestival, wristbandForPublicFestival } from "../domain/festivalPublicIdentity";
import { getPublicFestival } from "../data/festivalCompanyRepository";

const publicEditionId = "11111111-1111-4111-8111-111111111111";
const launchId = "22222222-2222-4222-8222-222222222222";
const annualEditionId = "33333333-3333-4333-8333-333333333333";
const otherEditionId = "44444444-4444-4444-8444-444444444444";
const attendanceId = "55555555-5555-4555-8555-555555555555";

const projection = {
  id: publicEditionId, festivalLaunchId: launchId, editionId: annualEditionId,
  slug: "summer-sound", name: "Summer Sound", tagline: null, description: "Annual festival",
  city: "Brighton", country: "UK", timezone: "Europe/London",
  startsAt: "2030-07-01T00:00:00Z", endsAt: "2030-07-03T23:00:00Z",
  festivalType: null, vibe: null, scale: null, heroImageReference: null, logoReference: null,
  launchStatus: "tickets_on_sale", soldOut: false, countdownTarget: "2030-07-01T00:00:00Z",
  stages: [], timetable: [], lineup: null, ticketSales: null, sponsors: [], ticketProducts: [],
  information: { travel: null, camping: null, accessibility: null, foodAndDrink: null,
    ageGuidance: null, terms: null, refundPolicy: null, contact: null }, visitorGuide: null,
};

const attendance: FestivalPlayerAttendance = {
  id: attendanceId, festivalLaunchId: launchId, festivalEditionId: annualEditionId,
  festivalName: "Summer Sound", festivalSlug: "summer-sound", startsOn: "2030-07-01", endsOn: "2030-07-03",
  cityId: null, admissionTicketId: "66666666-6666-4666-8666-666666666666", ticketReference: "SUMMER-1",
  ticketType: "general", includesCamping: false, includesVipArea: false, status: "attending",
  checkedInAt: "2030-07-01T09:00:00Z", leftAt: null, completedAt: null, createdAt: "2030-06-01T09:00:00Z",
};

const wristband: FestivalMemorabiliaItem = {
  id: "77777777-7777-4777-8777-777777777777", festivalLaunchId: launchId,
  festivalEditionId: annualEditionId, attendanceId,
  itemType: "wristband", itemKey: "summer-2030", displayName: "Summer Sound wristband",
  description: null, rarity: "common", metadata: {}, issuedAt: "2030-07-01T09:00:00Z",
};

describe("public Festival launch identity", () => {
  beforeEach(() => rpc.mockReset());
  it("retains the independently issued public, launch and annual edition UUIDs", () => {
    const parsed = parsePublicFestivalWithIdentity(projection);
    expect([parsed.id, parsed.festivalLaunchId, parsed.editionId]).toEqual([
      publicEditionId, launchId, annualEditionId,
    ]);
  });

  it("allows historical projections to render read-only but rejects invalid launch IDs", () => {
    expect(parsePublicFestivalWithIdentity({ ...projection, festivalLaunchId: undefined }).festivalLaunchId).toBeNull();
    expect(() => parsePublicFestivalWithIdentity({ ...projection, festivalLaunchId: "not-a-uuid" })).toThrow("malformed_public_festival_result");
    expect(() => parsePublicFestivalWithIdentity({ ...projection, festivalLaunchId: publicEditionId + "-extra" })).toThrow("malformed_public_festival_result");
  });

  it("matches the current edition's attendance rather than confusing it with a public edition", () => {
    const current = parsePublicFestivalWithIdentity(projection);
    const wrongEdition = { ...attendance, id: "88888888-8888-4888-8888-888888888888", festivalEditionId: otherEditionId };
    const wrongLaunch = { ...attendance, id: "99999999-9999-4999-8999-999999999999", festivalLaunchId: publicEditionId };
    const wrongSlug = { ...attendance, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", festivalSlug: "another-festival" };
    expect(attendanceForPublicFestival(current, [wrongEdition, wrongLaunch, wrongSlug, attendance])).toEqual(attendance);
    expect(attendanceForPublicFestival({ ...current, editionId: null }, [attendance])).toBeUndefined();
    expect(attendanceForPublicFestival({ ...current, festivalLaunchId: null }, [wrongEdition, attendance])).toEqual(attendance);
  });

  it("cannot display a wristband from a different admission, launch, or edition", () => {
    const others = [
      { ...wristband, id: "88888888-8888-4888-8888-888888888888", festivalEditionId: otherEditionId },
      { ...wristband, id: "99999999-9999-4999-8999-999999999999", festivalLaunchId: publicEditionId },
      { ...wristband, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", attendanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    ];
    expect(wristbandForPublicFestival(attendance, [...others, wristband])).toEqual(wristband);
    expect(wristbandForPublicFestival(undefined, [wristband])).toBeUndefined();
  });

  it("exposes launch identity only through the public published-edition boundary", () => {
    const sql = readFileSync("supabase/migrations/20300101011000_public_festival_launch_identity.sql", "utf8");
    expect(sql).toContain("public.get_public_festival_guide(p_slug)");
    expect(sql).toContain("launch.id = (projection->>'id')::uuid");
    expect(sql).toContain("launch.public_slug = p_slug OR profile.public_slug = p_slug");
    expect(sql).toContain("to_regclass('public.festival_public_editions') IS NOT NULL");
    expect(sql).toContain("edition.id = $1::uuid AND edition.slug = $2");
    expect(sql).toContain("USING projection->>'id', p_slug");
    expect(sql).toContain("'festivalLaunchId', matching_launch_id");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.get_public_festival_with_identity(text) FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_public_festival_with_identity(text) TO anon, authenticated");
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+public\./i);
  });

  it("fails closed on old RPCs and keeps purchased ticket and live data launch-scoped", () => {
    const page = readFileSync("src/features/festival-company/ui/PublicFestivalPage.tsx", "utf8");
    const grounds = readFileSync("src/features/festival-company/ui/FestivalGrounds.tsx", "utf8");
    const repository = readFileSync("src/features/festival-company/data/festivalCompanyRepository.ts", "utf8");
    expect(repository).toContain('launchRpc("get_public_festival_with_identity"');
    expect(repository).toContain('isMissingPublicRpc(verified.error,"get_public_festival_with_identity")');
    expect(page).toContain("!f.festivalLaunchId || buy.isPending");
    expect(page).toContain("festivalLaunchId: f.festivalLaunchId");
    expect(page).toContain('festivalLaunchId={f.festivalLaunchId ?? ""}');
    expect(page).not.toContain("festivalLaunchId: f.id");
    expect(page).not.toContain("festivalLaunchId={f.id}");
    expect(grounds).toContain("const liveEnabled = Boolean(!cancelled && festivalLaunchId && festivalEditionId)");
    expect(grounds).toContain("usePublicFestivalLiveStatus(liveEnabled ? slug : \"\")");
  });

  it("reads the published identity projection in one call", async () => {
    rpc.mockResolvedValueOnce({ data: projection, error: null });
    const result = await getPublicFestival(projection.slug);
    expect(result.festivalLaunchId).toBe(launchId);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_public_festival_with_identity", { p_slug: projection.slug });
  });

  it("falls back read-only when the identity RPC is not deployed", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function public.get_public_festival_with_identity" } })
      .mockResolvedValueOnce({ data: projection, error: null });
    const result = await getPublicFestival(projection.slug);
    expect(result.festivalLaunchId).toBe(launchId); // The guide can include it on newer databases.
    expect(rpc).toHaveBeenNthCalledWith(2, "get_public_festival_guide", { p_slug: projection.slug });
    rpc.mockReset();
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function public.get_public_festival_with_identity" } })
      .mockResolvedValueOnce({ data: { ...projection, festivalLaunchId: undefined }, error: null });
    expect((await getPublicFestival(projection.slug)).festivalLaunchId).toBeNull();
  });

  it("does not use a legacy fallback to conceal a denied or malformed identity projection", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "permission denied" } });
    await expect(getPublicFestival(projection.slug)).rejects.toThrow("festival_launch_unavailable");
    expect(rpc).toHaveBeenCalledTimes(1);
    rpc.mockReset();
    rpc.mockResolvedValueOnce({ data: { ...projection, festivalLaunchId: "fake" }, error: null });
    await expect(getPublicFestival(projection.slug)).rejects.toThrow("malformed_public_festival_result");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
