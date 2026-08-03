import { describe, expect, it } from "vitest";
import { festivalScheduleLoadErrorMessage } from "./errors";

describe("festivalScheduleLoadErrorMessage", () => {
  it("explains incomplete annual-edition setup", () => {
    expect(
      festivalScheduleLoadErrorMessage(
        new Error("FESTIVAL_SCHEDULE_SETUP_INCOMPLETE"),
      ),
    ).toMatch(/dates, city and site planning/i);
  });

  it("explains ambiguous historical schedule mappings", () => {
    expect(
      festivalScheduleLoadErrorMessage({
        message: "FESTIVAL_SCHEDULE_BRIDGE_AMBIGUOUS",
      }),
    ).toMatch(/administrator must repair/i);
  });

  it("explains permission failures without exposing raw RPC codes", () => {
    expect(
      festivalScheduleLoadErrorMessage("FESTIVAL_SCHEDULE_ACCESS_DENIED"),
    ).toBe("You do not have permission to manage this annual edition's schedule.");
  });

  it("explains when the requested annual edition no longer exists", () => {
    expect(
      festivalScheduleLoadErrorMessage(
        new Error("FESTIVAL_SCHEDULE_EDITION_NOT_FOUND"),
      ),
    ).toBe("This annual Festival edition could not be found.");
  });

  it("returns a safe fallback for unknown failures", () => {
    expect(
      festivalScheduleLoadErrorMessage(new Error("network unavailable")),
    ).toMatch(/could not be loaded/i);
  });
});
