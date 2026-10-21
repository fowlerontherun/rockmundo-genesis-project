import { describe, expect, it } from "vitest";
import { chooseInterviewShot } from "./interviewCamera";

describe("interview camera direction", () => {
  it("opens and closes on a wide two-person shot", () => {
    expect(chooseInterviewShot("intro", 0)).toBe("wide");
    expect(chooseInterviewShot("results", 6)).toBe("wide");
  });

  it("focuses the saved player avatar after answering", () => {
    expect(chooseInterviewShot("reaction", 0)).toBe("guest");
    expect(chooseInterviewShot("reaction", 6)).toBe("guest");
  });

  it("varies the question framing without any wall-clock timers", () => {
    expect(chooseInterviewShot("question", 0)).toBe("host");
    expect(chooseInterviewShot("question", 1)).toBe("wide");
    expect(chooseInterviewShot("question", 2)).toBe("host");
  });
});
