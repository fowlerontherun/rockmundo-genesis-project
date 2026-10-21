import { describe, expect, it } from "vitest";
import { getInterviewPresenter, getInterviewerResponse, stablePresenterHash } from "./interviewPresenters";

describe("interview presenter continuity", () => {
  it("assigns the same named presenter to an outlet across repeated appearances", () => {
    const first = getInterviewPresenter("radio", "RockMundo Radio");
    expect(getInterviewPresenter("radio", "RockMundo Radio").id).toBe(first.id);
    expect(getInterviewPresenter("radio", "  ROCKMUNDO   RADIO ").id).toBe(first.id);
  });

  it("has a recurring illustrated presenter for every interview format", () => {
    const formats = ["radio", "tv", "podcast", "magazine", "newspaper", "internet", "film"];
    for (const type of formats) {
      const presenter = getInterviewPresenter(type, "The Daily Sound");
      expect(presenter.id).toBeTruthy();
      expect(presenter.name).toBeTruthy();
      expect(presenter.introduction).toBeTruthy();
      expect(presenter.farewell).toBeTruthy();
      expect(presenter.appearance.hair).toMatch(/^#/);
      expect(presenter.appearance.skin).toMatch(/^#/);
      expect(presenter.mediaType).toBe(type);
    }
  });

  it("offers multiple recurring hosts for a broadcast format", () => {
    const outlets = Array.from({ length: 50 }, (_, i) => getInterviewPresenter("tv", `Outlet ${i}`).id);
    expect(new Set(outlets).size).toBe(2);
  });

  it("keeps hash and fallback assignment deterministic", () => {
    expect(stablePresenterHash("radio:an outlet")).toBe(stablePresenterHash("radio:an outlet"));
    expect(getInterviewPresenter("unknown-format", "Outlet").id).toBe(getInterviewPresenter("unknown-format", "Outlet").id);
  });
});

describe("interviewer reactions", () => {
  const host = getInterviewPresenter("podcast", "The Long Listen");

  it("acknowledges all four answer styles with a short response", () => {
    const moods = ["warm", "curious", "challenging", "amused"];
    (["a", "b", "c", "d"] as const).forEach((option, i) => {
      const reaction = getInterviewerResponse(host, "question-id-01", option, false);
      expect(reaction.mood).toBe(moods[i]);
      expect(reaction.text.length).toBeGreaterThan(8);
      expect(getInterviewerResponse(host, "question-id-01", option, false)).toEqual(reaction);
    });
  });

  it("uses an awkward reaction when time runs out, regardless of the random answer", () => {
    expect(getInterviewerResponse(host, "question-id", "b", true).mood).toBe("awkward");
    expect(getInterviewerResponse(host, "question-id", "d", true).mood).toBe("awkward");
  });
});
