import { describe, expect, it } from "vitest";
import { totpExportFileName } from "./exportBroadcast";

describe("totpExportFileName", () => {
  it("builds a broadcast-safe webm name from episode number and date", () => {
    expect(totpExportFileName(12, "2026-09-19T00:00:00Z")).toBe("top-of-the-pops-episode-12-2026-09-19.webm");
  });

  it("falls back to a generic episode label when the number is missing", () => {
    expect(totpExportFileName(null, "2026-09-19")).toBe("top-of-the-pops-episode-2026-09-19.webm");
  });

  it("uses the mp4 extension when the recorder produced mp4", () => {
    const blob = new Blob(["x"], { type: "video/mp4" });
    expect(totpExportFileName(3, "2026-09-19", blob)).toBe("top-of-the-pops-episode-3-2026-09-19.mp4");
  });

  it("defaults to today's date when no episode date is given", () => {
    const name = totpExportFileName(1, null);
    expect(name).toMatch(/^top-of-the-pops-episode-1-\d{4}-\d{2}-\d{2}\.webm$/);
  });
});
