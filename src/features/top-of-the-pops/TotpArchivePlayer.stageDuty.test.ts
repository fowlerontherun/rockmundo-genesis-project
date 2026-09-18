import { describe, expect, it } from "vitest";
import type { TotpArchivedBandMember } from "./api";
import { memberStageDuty } from "./TotpArchivePlayer";

describe("Top of the Pops stage duties", () => {
  it("keeps touring members and makes the player guitarist the fallback singer when no singer is declared", () => {
    const members: TotpArchivedBandMember[] = [
      {
        profile_id: "26f2d914-849a-4377-95b3-389d6bc7815d",
        display_name: "Big Fowler",
        role: "Founder",
        instrument_role: "Acoustic Guitar",
        vocal_role: null,
      },
      {
        profile_id: null,
        display_name: "Luna Riot",
        role: "Luna Riot",
        instrument_role: "Drums",
        vocal_role: null,
      },
      {
        profile_id: null,
        display_name: "Sable Vox the Virtuoso",
        role: "Sable Vox the Virtuoso",
        instrument_role: "Guitar",
        vocal_role: null,
      },
    ];

    expect(memberStageDuty(members[0], members)).toBe("Acoustic Guitar / Lead Vocals");
    expect(memberStageDuty(members[1], members)).toBe("Drums");
    expect(memberStageDuty(members[2], members)).toBe("Guitar");
  });

  it("preserves an explicit instrument plus vocal duty and does not invent another singer", () => {
    const members: TotpArchivedBandMember[] = [
      {
        profile_id: "a",
        display_name: "Singer guitarist",
        role: "member",
        instrument_role: "Electric Guitar",
        vocal_role: "Lead Singer",
      },
      {
        profile_id: "b",
        display_name: "Bass player",
        role: "member",
        instrument_role: "Bass Guitar",
        vocal_role: null,
      },
    ];

    expect(memberStageDuty(members[0], members)).toBe("Electric Guitar / Lead Singer");
    expect(memberStageDuty(members[1], members)).toBe("Bass Guitar");
  });
});
