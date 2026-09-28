import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hooks = readFileSync("src/features/festivals/booking/hooks.ts", "utf8");
const editor = readFileSync("src/features/festivals/booking/components/FestivalSetlistEditor.tsx", "utf8");

describe("festival setlist approval transition safeguards", () => {
  it("refreshes canonical contract and setlist data after every transition", () => {
    const transitions = hooks.slice(hooks.indexOf("export function useFestivalSetlist("), hooks.indexOf("export function useFestivalRepresentedBands("));
    expect(transitions).toContain("festivalBookingKeys.contracts(undefined, contractId)");
    expect(transitions).toContain("festivalBookingKeys.setlist(contractId)");
    for (const action of ["saveDraft", "submitSetlist", "reviewSetlist", "lockSetlist"]) {
      expect(transitions).toMatch(new RegExp(action + ":[\\s\\S]*?onSuccess: invalidateSetlist"));
    }
  });

  it("does not submit an edited or still-saving draft", () => {
    expect(editor).toContain("savedFingerprint !== fp");
    expect(editor).toContain("saveDraft.isPending || submitSetlist.isPending");
    expect(editor).toContain("preflight.isSuccess");
  });

  it("shows the organiser the outcome of locking the approved setlist", () => {
    expect(editor).toContain('toast.success("Approved festival setlist locked")');
    expect(editor).toContain("lockKey.markSucceeded()");
  });
});
