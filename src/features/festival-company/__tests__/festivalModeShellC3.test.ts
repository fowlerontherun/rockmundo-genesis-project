import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  clearFestivalModeReturnPath,
  festivalModeReturnStorageKey,
  isFestivalModeSupportPath,
  readFestivalModeReturnPath,
  rememberFestivalModeReturnPath,
} from "../attendance/festivalModeRouting";

const layoutSource = readFileSync("src/components/Layout.tsx", "utf8");
const shellSource = readFileSync(
  "src/features/festival-company/attendance/FestivalModeShell.tsx",
  "utf8",
);

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

describe("Festival Mode C3 shell", () => {
  it("allows only explicit account and support routes through the reduced shell", () => {
    expect(isFestivalModeSupportPath("/inbox")).toBe(true);
    expect(isFestivalModeSupportPath("/settings/safety/reports")).toBe(true);
    expect(isFestivalModeSupportPath("/settings/privacy/blocked-players")).toBe(true);
    expect(isFestivalModeSupportPath("/finance/banking")).toBe(false);
    expect(isFestivalModeSupportPath("/travel")).toBe(false);
    expect(isFestivalModeSupportPath("/admin")).toBe(false);
  });

  it("keeps the pre-festival return route stable while support pages are visited", () => {
    const storage = createStorage();
    const profileId = "profile-1";

    expect(
      rememberFestivalModeReturnPath(storage, profileId, {
        pathname: "/festival-companies/company-1/editions/edition-1",
        search: "?tab=tickets",
      }),
    ).toBe("/festival-companies/company-1/editions/edition-1?tab=tickets");

    expect(
      rememberFestivalModeReturnPath(storage, profileId, {
        pathname: "/inbox",
      }),
    ).toBe("/festival-companies/company-1/editions/edition-1?tab=tickets");

    expect(readFestivalModeReturnPath(storage, profileId)).toBe(
      "/festival-companies/company-1/editions/edition-1?tab=tickets",
    );
  });

  it("rejects unsafe stored return paths and clears Festival Mode state after exit", () => {
    const storage = createStorage();
    const profileId = "profile-2";
    storage.setItem(festivalModeReturnStorageKey(profileId), "//evil.example/path");
    expect(readFestivalModeReturnPath(storage, profileId)).toBeNull();

    storage.setItem(festivalModeReturnStorageKey(profileId), "/home");
    clearFestivalModeReturnPath(storage, profileId);
    expect(storage.getItem(festivalModeReturnStorageKey(profileId))).toBeNull();
  });

  it("drives Festival Mode from authoritative attending state above desktop and mobile shells", () => {
    expect(layoutSource).toContain('attendance.status === "attending"');
    expect(layoutSource.indexOf("if (activeFestivalAttendance)")).toBeLessThan(
      layoutSource.indexOf("if (isMobile)"),
    );
    expect(layoutSource).toContain("supportContent={festivalSupportRoute ? <Outlet /> : undefined}");
    expect(layoutSource).toContain("festivalAttendanceError");
    expect(layoutSource).toContain("Normal gameplay stays locked until RockMundo reconnects");
  });

  it("provides distinct desktop and mobile Festival Mode shells without the normal nav", () => {
    expect(shellSource).toContain('data-festival-mode-device="mobile"');
    expect(shellSource).toContain('data-festival-mode-device="desktop"');
    expect(shellSource).toContain('aria-label="Festival navigation"');
    expect(shellSource).toContain("normal RockMundo gameplay navigation is intentionally unavailable");
    expect(shellSource).not.toContain("FMSidebar");
    expect(shellSource).not.toContain("BottomNav");
    expect(shellSource).not.toContain("ModuleTabs");
  });

  it("preserves inbox, safety and bug-report access while attending", () => {
    expect(shellSource).toContain('to="/inbox"');
    expect(shellSource).toContain('to: "/settings/safety/reports"');
    expect(shellSource).toContain('to: "/settings/privacy/blocked-players"');
    expect(shellSource).toContain("<BugReportButton />");
  });

  it("restores the captured route after leave or authoritative completion", () => {
    expect(layoutSource).toContain("rememberFestivalModeReturnPath(window.sessionStorage");
    expect(layoutSource).toContain("readFestivalModeReturnPath(window.sessionStorage, profileId) ?? \"/home\"");
    expect(layoutSource).toContain("clearFestivalModeReturnPath(window.sessionStorage, profileId)");
    expect(layoutSource).toContain("navigate(returnPath, { replace: true })");
  });
});
